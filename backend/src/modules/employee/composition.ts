import { MongoEmployeeBankAccountRepo, MongoEmployeeContractRepo, MongoEmployeeRepo } from "@modules/employee/adapters/driven/persistence/mongodb";
import { Db as MongoDb } from "mongodb";

/** Một đoạn hợp đồng có hiệu lực trong một khoảng, đã cắt về trong biên khoảng đó. */
export interface EmployeeContractSegment {
    contractId:       string;
    contractNumber:   string;
    baseSalary:       number;
    employmentStatus: "official" | "probation" | "internship";
    from:             Date;
    to:               Date;
}

/**
 * Thông tin cần để chi trả lương cho một nhân viên — dùng bởi Payroll khi sinh
 * file chuyển khoản. `bankAccountNumber` rỗng nghĩa là nhân viên chưa khai tài
 * khoản: Payroll phải loại họ khỏi file và báo rõ, không tự điền gì.
 */
export interface EmployeePayoutInfo {
    employeeId:          string;
    employeeCode:        string;
    fullName:            string;
    bankAccountNumber:   string;
    bankAccountHolder:   string;
    bankName:            string;
    bankBranch:          string | null;
}

/** Cơ sở hợp đồng active của một nhân viên tại một ngày — dùng bởi module Payroll. */
export interface EmployeeContractBasis {
    contractId:       string;
    employeeId:       string;
    baseSalary:       number;
    employmentStatus: "official" | "probation" | "internship";
}

/**
 * Cổng tra cứu sự tồn tại của nhân viên mà module khác (vd: Attendance,
 * Payroll) được phép tiêu thụ, KHÔNG cần import trực tiếp repo Mongo nội bộ
 * của Employee.
 */
export interface EmployeeDirectory {
    employeeExists(employeeId: string): Promise<boolean>;
    /** Id toàn bộ nhân viên đang `active` — dùng bởi Payroll khi chạy lương cả kỳ. */
    listActiveEmployeeIds(): Promise<string[]>;
    /** Cơ sở hợp đồng active của nhân viên tại một ngày, hoặc `undefined` nếu không có — dùng bởi Payroll. */
    contractBasis(employeeId: string, atDate: Date): Promise<EmployeeContractBasis | undefined>;
    /**
     * Các đoạn hợp đồng active phủ khoảng [from, to], đã cắt về trong biên và sắp
     * theo thời gian — dùng bởi Payroll để tách dòng khi đổi hợp đồng giữa kỳ.
     */
    contractSegments(employeeId: string, from: Date, to: Date): Promise<EmployeeContractSegment[]>;
    /** Id nhân viên gắn với một tài khoản đăng nhập — dùng bởi Payroll cho tự-phục vụ. */
    findEmployeeIdByUserId(userId: string): Promise<string | undefined>;
    /**
     * Thông tin chi trả (mã, tên, tài khoản ngân hàng CHÍNH) — dùng bởi Payroll khi
     * xuất file chuyển lương. `undefined` khi không tìm thấy nhân viên.
     */
    payoutInfo(employeeId: string): Promise<EmployeePayoutInfo | undefined>;
    /**
     * `employeeId` có nằm dưới quyền quản lý của `actorUserId` không — xét theo
     * chuỗi quản lý trực tiếp, mọi tầng. Dùng bởi Attendance để Manager chỉ
     * duyệt được đơn của cấp dưới mình.
     */
    isManagedBy(employeeId: string, actorUserId: string): Promise<boolean>;
    /**
     * Chinh minh + toan bo cap duoi moi tang cua mot tai khoan dang nhap. Mang
     * rong khi tai khoan khong gan voi nhan vien nao — CO Y: tha tra rong con
     * hon mo toan bo du lieu vi thieu lien ket.
     */
    listTeamEmployeeIds(actorUserId: string): Promise<string[]>;
    /**
     * Account cua quan ly truc tiep — nguoi cham mac dinh khi module Performance
     * phan cong tu dong. `undefined` khi khong co quan ly, hoac quan ly chua duoc
     * cap tai khoan dang nhap.
     */
    managerAccountIdOf(employeeId: string): Promise<string | undefined>;
}

/** Trần độ sâu khi leo chuỗi quản lý — chặn treo nếu dữ liệu bị tạo vòng. */
const MAX_MANAGER_CHAIN_DEPTH = 50;

/**
 * Lắp `EmployeeDirectory` trên nền MongoDB — điểm nối duy nhất để module
 * khác dùng dữ liệu tồn tại của Employee mà vẫn giữ ranh giới module: chỉ
 * composition root (infra) mới được phép import cả hai module để nối dây.
 * Tái dùng nguyên `MongoEmployeeRepo`/`MongoEmployeeContractRepo` hiện có,
 * không tạo repo song song.
 */
export function createEmployeeDirectory(mongoDb: MongoDb): EmployeeDirectory {
    const employeeRepo = new MongoEmployeeRepo(mongoDb);
    const contractRepo = new MongoEmployeeContractRepo(mongoDb);
    const bankAccountRepo = new MongoEmployeeBankAccountRepo(mongoDb);

    return {
        employeeExists: async (employeeId: string) => (await employeeRepo.getById(employeeId)) != undefined,

        listActiveEmployeeIds: async () => {
            const employees = await employeeRepo.list({ status: "active" });
            return employees.map(e => e.id);
        },

        contractBasis: async (employeeId: string, atDate: Date) => {
            const contracts = await contractRepo.listByEmployeeId(employeeId);
            const active = contracts.find(c =>
                c.status === "active" && c.startDate <= atDate && (c.endDate == null || c.endDate >= atDate),
            );
            if (active == undefined) return undefined;
            return {
                contractId: active.id,
                employeeId,
                baseSalary: active.baseSalary,
                employmentStatus: active.employmentStatus,
            };
        },

        contractSegments: async (employeeId: string, from: Date, to: Date) => {
            const contracts = await contractRepo.listByEmployeeId(employeeId);

            return contracts
                .filter(contract =>
                    contract.status === "active"
                    // Giao nhau với [from, to]: bắt đầu trước khi khoảng kết thúc,
                    // và (vô thời hạn hoặc) kết thúc sau khi khoảng bắt đầu.
                    && contract.startDate <= to
                    && (contract.endDate == null || contract.endDate >= from),
                )
                // Cắt về trong biên khoảng: phần hợp đồng nằm ngoài kỳ không đóng
                // góp ngày công nào của kỳ này.
                .map(contract => ({
                    contractId:       contract.id,
                    contractNumber:   contract.contractNumber,
                    baseSalary:       contract.baseSalary,
                    employmentStatus: contract.employmentStatus,
                    from:             contract.startDate > from ? contract.startDate : from,
                    to:               contract.endDate != null && contract.endDate < to ? contract.endDate : to,
                }))
                .sort((a, b) => a.from.getTime() - b.from.getTime());
        },

        findEmployeeIdByUserId: async (userId: string) => (await employeeRepo.getByAccountId(userId))?.id,

        payoutInfo: async (employeeId: string) => {
            const employee = await employeeRepo.getById(employeeId);
            if (employee == undefined) return undefined;

            const accounts = await bankAccountRepo.listByEmployeeId(employeeId);
            // Tài khoản CHÍNH; không có cờ chính thì lấy bản ghi đầu (nhân viên chỉ
            // khai một tài khoản là trường hợp thường gặp nhất).
            const account = accounts.find(row => row.isPrimary) ?? accounts[0];

            return {
                employeeId,
                employeeCode:      employee.code.value,
                fullName:          employee.name.value,
                bankAccountNumber: account?.accountNumber ?? "",
                bankAccountHolder: account?.accountHolder ?? employee.name.value,
                bankName:          account?.bankName ?? "",
                bankBranch:        account?.branch ?? null,
            };
        },

        // Leo NGƯỢC chuỗi quản lý từ nhân viên lên trên: rẻ hơn duyệt xuống toàn
        // bộ cấp dưới của actor (mỗi tầng đúng một lần đọc), và trả lời đúng câu
        // hỏi cần trả lời — "actor có nằm trên đường quản lý của người này?".
        isManagedBy: async (employeeId: string, actorUserId: string) => {
            const visited = new Set<string>([employeeId]);
            let current   = await employeeRepo.getById(employeeId);

            for (let depth = 0; depth < MAX_MANAGER_CHAIN_DEPTH; depth += 1) {
                const managerId = current?.managerId;
                if (managerId == undefined || visited.has(managerId)) return false;
                visited.add(managerId);

                const manager = await employeeRepo.getById(managerId);
                if (manager == undefined) return false;
                if (manager.accountId === actorUserId) return true;

                current = manager;
            }
            return false;
        },

        managerAccountIdOf: async (employeeId: string) => {
            const employee = await employeeRepo.getById(employeeId);
            if (employee?.managerId == null) return undefined;

            const manager = await employeeRepo.getById(employee.managerId);
            return manager?.accountId ?? undefined;
        },

        listTeamEmployeeIds: async (actorUserId: string) => {
            const root = await employeeRepo.getByAccountId(actorUserId);
            if (root == undefined) return [];

            // Duyet theo chieu rong xuong duoi, tap da tham tu chong vong lap.
            const collected = new Set<string>([root.id]);
            let frontier = [root.id];

            for (let depth = 0; depth < MAX_MANAGER_CHAIN_DEPTH && frontier.length > 0; depth += 1) {
                const next: string[] = [];
                for (const managerId of frontier) {
                    for (const reportId of await employeeRepo.listDirectReportIds(managerId)) {
                        if (collected.has(reportId)) continue;
                        collected.add(reportId);
                        next.push(reportId);
                    }
                }
                frontier = next;
            }

            return [...collected];
        },
    };
}

/** Hồ sơ nhân viên dạng tối giản cho các màn tổng hợp (bảng điều khiển). */
export interface EmployeeSummary {
    id:           string;
    code:         string;
    name:         string;
    departmentId: string;
    hireDate:     Date;
    status:       string;
}

/**
 * Bề mặt đọc danh bạ nhân viên cho READ MODEL (module Dashboard).
 *
 * Tách khỏi `EmployeeDirectory`: cổng kia phục vụ nghiệp vụ (hợp đồng, phạm vi
 * quản lý), còn cổng này chỉ trả những trường hiển thị được. KHÔNG có email,
 * điện thoại, tài khoản ngân hàng hay bất kỳ PII nào khác — bảng điều khiển
 * không cần và không được nhận chúng.
 */
export interface EmployeeSummaryDirectory {
    listAll(): Promise<EmployeeSummary[]>;
    listByIds(employeeIds: readonly string[]): Promise<EmployeeSummary[]>;
}

export function createEmployeeSummaryDirectory(mongoDb: MongoDb): EmployeeSummaryDirectory {
    const employeeRepo = new MongoEmployeeRepo(mongoDb);

    const toSummary = (employee: {
        id: string; code: { value: string }; name: { value: string };
        departmentId: string; hireDate: Date; status: { value: string };
    }): EmployeeSummary => ({
        id:           employee.id,
        code:         employee.code.value,
        name:         employee.name.value,
        departmentId: employee.departmentId,
        hireDate:     employee.hireDate,
        status:       employee.status.value,
    });

    return {
        listAll: async () => (await employeeRepo.list({})).map(toSummary),
        listByIds: async (employeeIds: readonly string[]) =>
            // Mảng rỗng -> không truy vấn: `$in: []` trả rỗng nhưng vẫn tốn một round-trip.
            employeeIds.length === 0 ? [] : (await employeeRepo.list({ ids: [...employeeIds] })).map(toSummary),
    };
}
