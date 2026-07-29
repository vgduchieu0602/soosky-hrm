import { MongoEmployeeContractRepo, MongoEmployeeRepo } from "@modules/employee/adapters/driven/persistence/mongodb";
import { Db as MongoDb } from "mongodb";

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
    /** Id nhân viên gắn với một tài khoản đăng nhập — dùng bởi Payroll cho tự-phục vụ. */
    findEmployeeIdByUserId(userId: string): Promise<string | undefined>;
}

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

        findEmployeeIdByUserId: async (userId: string) => {
            const employees = await employeeRepo.list({});
            return employees.find(e => e.accountId === userId)?.id;
        },
    };
}
