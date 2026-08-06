import { MongoPermissionRepo, MongoRolePermissionRepo, MongoRoleRepo } from "@modules/iam/adapters/driven/persistence/mongodb";
import Permission from "@modules/iam/core/domain/entities/Permission";
import Role from "@modules/iam/core/domain/entities/Role";
import RolePermission from "@modules/iam/core/domain/entities/RolePermission";
import PermissionKey from "@modules/iam/core/domain/value-objects/PermissionKey";
import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";
import RoleName from "@modules/iam/core/domain/value-objects/RoleName";
import { Db as MongoDb } from "mongodb";
import { v7 as UUIDv7 } from "uuid";

/**
 * Catalog quyền hạn hệ thống.
 *
 * Khoá có hậu tố `:team` / `:self` là bản THU HẸP PHẠM VI của khoá gốc: giữ
 * `employee:read:team` nghĩa là đọc được chính mình + cấp dưới theo chuỗi quản
 * lý; `employee:read` (không hậu tố) là đọc được tất cả. Quy tắc suy ra phạm
 * vi nằm ở `shared/core/app/authorization/PermissionScope.ts`.
 *
 * `<resource>:manage` bao trùm mọi hành động của resource đó (kể cả đọc).
 */
const SYSTEM_PERMISSIONS: { key: string; description: string }[] = [
    { key: "*",                  description: "Toàn quyền hệ thống" },

    { key: "iam:manage",         description: "Quản trị user, role, phân quyền" },
    { key: "audit:read",         description: "Xem nhật ký thao tác" },

    // Bảng điều khiển có KHOÁ RIÊNG, không tái dùng `employee:read`: nó quyết
    // định actor thấy tổng hợp ở phạm vi nào, độc lập với quyền đọc hồ sơ.
    { key: "dashboard:read",      description: "Xem bảng điều khiển toàn công ty" },
    { key: "dashboard:read:team", description: "Xem bảng điều khiển của nhóm mình quản lý" },
    { key: "dashboard:read:self", description: "Xem bảng điều khiển cá nhân" },

    { key: "department:manage",  description: "Tạo/sửa/xoá phòng ban và vị trí" },
    { key: "department:read",    description: "Xem cây phòng ban và danh sách vị trí" },

    { key: "employee:manage",    description: "Tạo/sửa/xoá nhân viên và toàn bộ hồ sơ đính kèm" },
    { key: "employee:read",      description: "Xem hồ sơ MỌI nhân viên" },
    { key: "employee:read:team", description: "Xem hồ sơ cấp dưới trực tiếp và gián tiếp" },
    { key: "employee:read:self", description: "Xem hồ sơ của chính mình" },
    { key: "employee:import",    description: "Nhập nhân viên từ file CSV" },
    { key: "employee:provision", description: "Cấp tài khoản đăng nhập cho nhân viên" },

    // Chấm công do HR đảm nhiệm HOÀN TOÀN — quyết định nghiệp vụ, không phải
    // thiếu sót. Vì vậy KHÔNG có khoá `attendance:*:self`: nhân viên không tự
    // check-in/check-out, không tự sửa bản ghi chấm công của mình. Muốn đổi thì
    // phải thêm khoá vào đây VÀ cho use-case tương ứng phân giải phạm vi —
    // đừng gán `attendance:manage` cho role `employee` để đi đường tắt, vì khoá
    // đó cho sửa chấm công của TẤT CẢ mọi người.
    { key: "attendance:manage",  description: "Quản trị ca, chấm công, ngày lễ, số dư phép (chỉ HR/Admin)" },
    // ĐỌC chấm công thì có tự phục vụ: nhân viên xem bảng công của mình, quản lý
    // xem của cấp dưới. GHI vẫn chỉ `attendance:manage`.
    { key: "attendance:read",      description: "Xem bảng công của MỌI nhân viên" },
    { key: "attendance:read:team", description: "Xem bảng công của chính mình và cấp dưới" },
    { key: "attendance:read:self", description: "Xem bảng công của chính mình" },

    // Chỉnh công: nhân viên KHÔNG sửa trực tiếp, chỉ gửi yêu cầu; quản lý/HR duyệt.
    { key: "correction:submit",      description: "Gửi yêu cầu chỉnh công cho MỌI nhân viên" },
    { key: "correction:submit:team", description: "Gửi yêu cầu chỉnh công cho mình và cấp dưới" },
    { key: "correction:submit:self", description: "Gửi yêu cầu chỉnh công của chính mình" },
    { key: "correction:approve",      description: "Duyệt/từ chối yêu cầu chỉnh công của MỌI nhân viên" },
    { key: "correction:approve:team", description: "Duyệt/từ chối yêu cầu chỉnh công của cấp dưới" },

    // Đơn nghỉ TÁCH khỏi `attendance:manage`: nhân viên tự nộp và tự xem đơn của
    // mình mà KHÔNG được chạm vào chấm công của ai. Ba nhóm hành động, mỗi nhóm
    // có bản thu hẹp phạm vi riêng.
    { key: "leave:submit",       description: "Nộp/huỷ đơn nghỉ cho MỌI nhân viên (HR nộp thay)" },
    { key: "leave:submit:team",  description: "Nộp/huỷ đơn nghỉ cho chính mình và cấp dưới" },
    { key: "leave:submit:self",  description: "Nộp/huỷ đơn nghỉ của chính mình" },
    { key: "leave:read",         description: "Xem đơn nghỉ và số dư phép của MỌI nhân viên" },
    { key: "leave:read:team",    description: "Xem đơn nghỉ và số dư phép của chính mình và cấp dưới" },
    { key: "leave:read:self",    description: "Xem đơn nghỉ và số dư phép của chính mình" },
    { key: "leave:approve",      description: "Duyệt/từ chối đơn nghỉ của MỌI nhân viên" },
    { key: "leave:approve:team", description: "Duyệt/từ chối đơn nghỉ của cấp dưới" },

    // Đánh giá hiệu suất. Tách `review` (chấm điểm) khỏi `manage` (quản trị chu kỳ,
    // bộ tiêu chí, duyệt và KHOÁ điểm): quản lý chấm được cấp dưới nhưng không
    // được tự duyệt rồi tự khoá điểm của chính nhóm mình.
    { key: "performance:manage",      description: "Quản trị chu kỳ, bộ tiêu chí, duyệt và khoá điểm đánh giá" },
    { key: "performance:review",      description: "Chấm điểm đánh giá cho MỌI nhân viên" },
    { key: "performance:review:team", description: "Chấm điểm đánh giá cho cấp dưới" },
    { key: "performance:read",        description: "Xem phiếu đánh giá của MỌI nhân viên" },
    { key: "performance:read:team",   description: "Xem phiếu đánh giá của chính mình và cấp dưới" },
    { key: "performance:read:self",   description: "Xem phiếu đánh giá của chính mình" },

    // Lập lương và DUYỆT lương tách hẳn hai khoá — nguyên tắc bốn mắt. Người
    // lập không được tự duyệt kỳ của mình, và điều đó còn được chặn thêm một
    // lớp ở use-case (`preparedBy !== approver`) kể cả khi ai đó giữ cả hai khoá.
    // Khoá `payroll:manage` cũ đã bỏ; bản ghi cũ trong DB còn lại là vô hại vì
    // không use-case nào kiểm nó nữa.
    { key: "payroll:prepare",    description: "Lập lương: kỳ, chấm dữ liệu đầu vào, tính/tính lại, hoàn tác phiếu draft" },
    { key: "payroll:approve",    description: "Duyệt bảng lương, đánh dấu đã chi trả, chốt/mở lại kỳ" },

    { key: "setting:manage",     description: "Cấu hình công ty và hệ thống" },
];

/**
 * Role hệ thống và tập quyền của từng role — bốn vai thực tế của một phòng nhân sự.
 *
 * Nguyên tắc: quyền hẹp nhất đủ làm việc.
 *  - `admin`    vận hành hệ thống → wildcard.
 *  - `hr`       làm nghiệp vụ nhân sự toàn công ty, KHÔNG quản trị phân quyền.
 *  - `manager`  chỉ nhìn và duyệt trong phạm vi cấp dưới của mình.
 *  - `employee` chỉ nhìn hồ sơ của chính mình.
 *
 * Mọi giới hạn này do BACKEND enforce trong use-case (`assertPermission` /
 * `resolveScope`); giao diện ẩn nút chỉ là chuyện trải nghiệm.
 */
const SYSTEM_ROLES: { key: string; name: string; description: string; permissions: string[] }[] = [
    {
        key:         "admin",
        name:        "Administrator",
        description: "Toàn quyền mọi module (role hệ thống, không sửa được)",
        permissions: ["*"],
    },
    {
        key:         "hr",
        name:        "Nhân sự",
        description: "Nghiệp vụ nhân sự toàn công ty: hồ sơ, hợp đồng, chấm công, lương",
        permissions: [
            "department:manage", "department:read",
            "employee:manage", "employee:read", "employee:import", "employee:provision",
            "attendance:manage", "attendance:read",
            "correction:submit", "correction:approve",
            "leave:submit", "leave:read", "leave:approve",
            "performance:manage", "performance:review", "performance:read",
            "payroll:prepare",
            "setting:manage",
            "audit:read",
            "dashboard:read",
        ],
    },
    {
        key:         "manager",
        name:        "Quản lý trực tiếp",
        description: "Xem hồ sơ, duyệt đơn nghỉ và chấm điểm đánh giá cho cấp dưới",
        permissions: [
            "department:read",
            "employee:read:team",
            "attendance:read:team",
            // Manager cũng là nhân viên: tự nộp/yêu cầu cho mình, và làm thay cấp dưới.
            "correction:submit:team", "correction:approve:team",
            "leave:submit:team", "leave:read:team", "leave:approve:team",
            "performance:review:team", "performance:read:team",
            "dashboard:read:team",
        ],
    },
    {
        key:         "employee",
        name:        "Nhân viên",
        // Tự phục vụ trong đúng phạm vi của mình: xem hồ sơ/phiếu lương, tự nộp
        // và tự huỷ đơn nghỉ. KHÔNG chạm được vào chấm công (xem ghi chú ở
        // `attendance:manage`) và không duyệt được đơn nào, kể cả đơn của mình.
        description: "Tự phục vụ: xem hồ sơ/bảng công/phiếu lương/phiếu đánh giá; nộp đơn nghỉ và yêu cầu chỉnh công của mình",
        permissions: [
            "employee:read:self",
            "attendance:read:self",
            "correction:submit:self",
            "leave:submit:self", "leave:read:self",
            "performance:read:self",
            "dashboard:read:self",
        ],
    },
];

/** Role gán cho user mới khi account được xác minh. */
export const DEFAULT_USER_ROLE_KEY = "employee";

/** Role bootstrap: user đầu tiên của hệ thống nhận role này. */
export const SYSTEM_ADMIN_ROLE_KEY = "admin";

/**
 * Nạp catalog quyền hạn + role hệ thống — chạy một lần lúc khởi động (server
 * lẫn CLI), ngay sau `ensureMongoIndexes`.
 *
 * Idempotent theo cả hai chiều:
 *  - permission/role đã tồn tại theo key thì KHÔNG tạo lại, KHÔNG ghi đè mô tả
 *    (giữ thay đổi thủ công của admin);
 *  - liên kết role→permission thì HỢP THÊM cái còn thiếu, không xoá cái admin
 *    đã tự gán. Nhờ vậy nâng cấp có thêm quyền mới thì role hệ thống tự nhận,
 *    mà tuỳ biến tại chỗ không bị mất.
 */
export default async function seedIam(mongoDb: MongoDb): Promise<void> {
    const permissionRepo     = new MongoPermissionRepo(mongoDb);
    const roleRepo           = new MongoRoleRepo(mongoDb);
    const rolePermissionRepo = new MongoRolePermissionRepo(mongoDb);

    // --- Quyền hạn ------------------------------------------------------------
    const permissionIdByKey = new Map<string, string>();
    for (const { key: rawKey, description } of SYSTEM_PERMISSIONS) {
        const key      = PermissionKey.create(rawKey);
        const existing = await permissionRepo.getByKey(key);
        if (existing != undefined) {
            permissionIdByKey.set(key.value, existing.id);
            continue;
        }

        const permission = Permission.create({ id: UUIDv7(), key, description });
        await permissionRepo.save(permission);
        permissionIdByKey.set(key.value, permission.id);
    }

    // --- Role + liên kết quyền -----------------------------------------------
    for (const spec of SYSTEM_ROLES) {
        const roleKey = RoleKey.create(spec.key);

        let role = await roleRepo.getByKey(roleKey);
        if (role == undefined) {
            role = Role.create({
                id:          UUIDv7(),
                key:         roleKey,
                name:        RoleName.create(spec.name),
                description: spec.description,
                isSystem:    true,
            });
            await roleRepo.save(role);
        }

        const current = await rolePermissionRepo.listByRoleId(role.id);
        const linked  = new Set(current.map(rolePermission => rolePermission.permissionId));

        for (const rawKey of spec.permissions) {
            const permissionId = permissionIdByKey.get(PermissionKey.create(rawKey).value);
            // Không thể xảy ra nếu catalog nhất quán; cảnh báo rồi bỏ qua thay vì
            // làm sập cả bước khởi động vì một khoá gõ sai.
            if (permissionId == undefined) {
                console.warn(`seedIam: role "${spec.key}" tham chiếu quyền không có trong catalog: ${rawKey}`);
                continue;
            }
            if (linked.has(permissionId)) continue;

            await rolePermissionRepo.save(RolePermission.create(UUIDv7(), role.id, permissionId));
        }
    }
}
