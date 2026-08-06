import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import User from "@modules/iam/core/domain/entities/User";
import UserRole from "@modules/iam/core/domain/entities/UserRole";
import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";
import createUuidV7 from "@shared/core/domain/UuidV7";

const SYSTEM_ADMIN_ROLE_KEY = "admin";

/**
 * Role mặc định của user mới. Không để user nào "không có role": role rỗng =
 * không có quyền nào = đăng nhập được nhưng mọi API trả 403, người dùng không
 * hiểu vì sao. `employee` là mức thấp nhất, chỉ xem được hồ sơ của chính mình.
 *
 * Trùng giá trị với `DEFAULT_USER_ROLE_KEY` trong `infra/db/seedIam.ts` nhưng
 * khai lại ở đây: module core KHÔNG được import từ tầng infra.
 */
const DEFAULT_USER_ROLE_KEY = "employee";

export interface ProjectUserFromAccountInput {
    accountId:   string;
    displayName: string;
    email:       string;
}

/**
 * Tạo bản chiếu `User` khi nhận sự kiện `auth.account.verified` — được gọi từ
 * event handler, không qua kiểm tra quyền hạn (đây không phải thao tác do
 * người dùng chủ động thực hiện).
 *
 * Idempotent: user đã tồn tại (account được xác minh lại, hoặc sự kiện được
 * gửi lại) thì bỏ qua.
 *
 * Bootstrap: nếu chưa có user nào giữ role hệ thống "admin", user mới tạo
 * (chính là user đầu tiên của hệ thống trong trường hợp thông thường) được
 * tự động gán role đó — hệ thống luôn có ít nhất một admin để tự vận hành.
 */
export default class ProjectUserFromAccountUseCase {
    public constructor(
        private readonly _userRepo: UserRepo,
        private readonly _roleRepo: RoleRepo,
        private readonly _userRoleRepo: UserRoleRepo,
    ) {}

    /**
     * @param input.accountId   Id account bên module Auth — dùng làm id của User.
     * @param input.displayName Họ tên hiển thị lấy từ sự kiện `auth.account.verified`.
     * @param input.email       Email lấy từ sự kiện `auth.account.verified`.
     */
    public async execute(input: ProjectUserFromAccountInput): Promise<void> {
        if (await this._userRepo.existsById(input.accountId)) return;

        const user = User.create({
            id:          input.accountId,
            displayName: input.displayName,
            email:       input.email,
        });
        await this._userRepo.save(user);

        const adminRole = await this._roleRepo.getByKey(RoleKey.create(SYSTEM_ADMIN_ROLE_KEY));
        if (adminRole == undefined) return; // seed chưa chạy — bỏ qua, không chặn projection

        // User đầu tiên của hệ thống → admin (bootstrap). Từ user thứ hai trở đi
        // → role mặc định `employee`; HR/Admin nâng quyền sau qua IAM.
        const hasAdmin = await this._userRoleRepo.existsByRoleId(adminRole.id);
        if (!hasAdmin) {
            await this._userRoleRepo.save(UserRole.create(createUuidV7(), user.id, adminRole.id));
            return;
        }

        const defaultRole = await this._roleRepo.getByKey(RoleKey.create(DEFAULT_USER_ROLE_KEY));
        if (defaultRole == undefined) return;

        await this._userRoleRepo.save(UserRole.create(createUuidV7(), user.id, defaultRole.id));
    }
}
