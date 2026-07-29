import { MongoAccountRepo, MongoRefreshTokenStore, MongoVerificationTokenStore } from "@modules/auth/adapters/driven/persistence/mongodb";
import { MongoAttendanceRepo, MongoAttendanceSymbolRepo, MongoHolidayRepo, MongoLeaveBalanceRepo, MongoLeaveRequestRepo, MongoShiftRepo } from "@modules/attendance/adapters/driven/persistence/mongodb";
import { MongoDepartmentRepo, MongoPositionRepo } from "@modules/department/adapters/driven/persistence/mongodb";
import { MongoEmployeeAssetRepo, MongoEmployeeBankAccountRepo, MongoEmployeeContactRepo, MongoEmployeeContractRepo, MongoEmployeeDocumentRepo, MongoEmployeeHistoryRepo, MongoEmployeeProfileRepo, MongoEmployeeRepo } from "@modules/employee/adapters/driven/persistence/mongodb";
import { MongoAuditRepo, MongoPermissionRepo, MongoRolePermissionRepo, MongoRoleRepo, MongoUserRepo, MongoUserRoleRepo } from "@modules/iam/adapters/driven/persistence/mongodb";
import { MongoAllowanceRepo, MongoBonusRepo, MongoDeductionRepo, MongoPayrollPeriodRepo, MongoPayslipRepo, MongoSalaryPolicyRepo, MongoTaxProfileRepo } from "@modules/payroll/adapters/driven/persistence/mongodb";
import { MongoCompanyProfileRepo, MongoSystemSettingRepo } from "@modules/setting/adapters/driven/persistence/mongodb";
import { Db as MongoDb } from "mongodb";

/**
 * Tạo toàn bộ index MongoDB mà các module cần — bước khởi tạo schema duy
 * nhất, gọi một lần lúc khởi động (server lẫn CLI), trước khi lắp ráp
 * use-case. Các DI factory nhờ vậy thuần tuý nối dây, không mang side effect.
 *
 * `createIndex` là idempotent: index đã tồn tại đúng cấu hình thì bỏ qua,
 * nên gọi lại mỗi lần khởi động là an toàn.
 */
export default async function ensureMongoIndexes(mongoDb: MongoDb): Promise<void> {
    // Auth
    await MongoAccountRepo.ensureIndexes(mongoDb);
    await MongoRefreshTokenStore.ensureIndexes(mongoDb);
    await MongoVerificationTokenStore.ensureIndexes(mongoDb);

    // IAM
    await MongoUserRepo.ensureIndexes(mongoDb);
    await MongoRoleRepo.ensureIndexes(mongoDb);
    await MongoPermissionRepo.ensureIndexes(mongoDb);
    await MongoUserRoleRepo.ensureIndexes(mongoDb);
    await MongoRolePermissionRepo.ensureIndexes(mongoDb);
    await MongoAuditRepo.ensureIndexes(mongoDb);

    // Department
    await MongoDepartmentRepo.ensureIndexes(mongoDb);
    await MongoPositionRepo.ensureIndexes(mongoDb);

    // Employee
    await MongoEmployeeRepo.ensureIndexes(mongoDb);
    await MongoEmployeeProfileRepo.ensureIndexes(mongoDb);
    await MongoEmployeeContactRepo.ensureIndexes(mongoDb);
    await MongoEmployeeBankAccountRepo.ensureIndexes(mongoDb);
    await MongoEmployeeDocumentRepo.ensureIndexes(mongoDb);
    await MongoEmployeeContractRepo.ensureIndexes(mongoDb);
    await MongoEmployeeAssetRepo.ensureIndexes(mongoDb);
    await MongoEmployeeHistoryRepo.ensureIndexes(mongoDb);

    // Attendance
    await MongoShiftRepo.ensureIndexes(mongoDb);
    await MongoHolidayRepo.ensureIndexes(mongoDb);
    await MongoAttendanceSymbolRepo.ensureIndexes(mongoDb);
    await MongoAttendanceRepo.ensureIndexes(mongoDb);
    await MongoLeaveRequestRepo.ensureIndexes(mongoDb);
    await MongoLeaveBalanceRepo.ensureIndexes(mongoDb);

    // Payroll
    await MongoPayrollPeriodRepo.ensureIndexes(mongoDb);
    await MongoPayslipRepo.ensureIndexes(mongoDb);
    await MongoAllowanceRepo.ensureIndexes(mongoDb);
    await MongoBonusRepo.ensureIndexes(mongoDb);
    await MongoDeductionRepo.ensureIndexes(mongoDb);
    await MongoTaxProfileRepo.ensureIndexes(mongoDb);
    await MongoSalaryPolicyRepo.ensureIndexes(mongoDb);

    // Setting
    await MongoCompanyProfileRepo.ensureIndexes(mongoDb);
    await MongoSystemSettingRepo.ensureIndexes(mongoDb);
}
