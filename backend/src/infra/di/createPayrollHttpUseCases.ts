import { MongoAllowanceRepo, MongoBonusRepo, MongoDeductionRepo, MongoPayrollPeriodRepo, MongoPayslipRepo, MongoSalaryPolicyRepo, MongoTaxProfileRepo, MongoUnitOfWork } from "@modules/payroll/adapters/driven/persistence/mongodb";
import { PayrollHttpUseCases } from "@modules/payroll/adapters/driver/http";
import PayrollRunPort from "@modules/payroll/core/app/ports/PayrollRunPort";
import PermissionChecker from "@modules/payroll/core/app/ports/PermissionChecker";
import AttendanceReadinessUseCase from "@modules/payroll/core/app/use-cases/period/AttendanceReadinessUseCase";
import ClosePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/ClosePayrollPeriodUseCase";
import CreatePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/CreatePayrollPeriodUseCase";
import DeletePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/DeletePayrollPeriodUseCase";
import EvaluationReadinessUseCase from "@modules/payroll/core/app/use-cases/period/EvaluationReadinessUseCase";
import GetPayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/GetPayrollPeriodUseCase";
import ListPayrollPeriodsUseCase from "@modules/payroll/core/app/use-cases/period/ListPayrollPeriodsUseCase";
import LockAttendanceUseCase from "@modules/payroll/core/app/use-cases/period/LockAttendanceUseCase";
import LockEvaluationsUseCase from "@modules/payroll/core/app/use-cases/period/LockEvaluationsUseCase";
import ReopenPayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/ReopenPayrollPeriodUseCase";
import UnlockAttendanceUseCase from "@modules/payroll/core/app/use-cases/period/UnlockAttendanceUseCase";
import UnlockEvaluationsUseCase from "@modules/payroll/core/app/use-cases/period/UnlockEvaluationsUseCase";
import UpdatePayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/period/UpdatePayrollPeriodUseCase";
import ApprovePayrollUseCase from "@modules/payroll/core/app/use-cases/payroll/ApprovePayrollUseCase";
import ExportPayrollPeriodUseCase from "@modules/payroll/core/app/use-cases/payroll/ExportPayrollPeriodUseCase";
import GetPayrollUseCase from "@modules/payroll/core/app/use-cases/payroll/GetPayrollUseCase";
import GrossUpUseCase from "@modules/payroll/core/app/use-cases/payroll/GrossUpUseCase";
import ListMyPayrollsUseCase from "@modules/payroll/core/app/use-cases/payroll/ListMyPayrollsUseCase";
import ListPayrollsUseCase from "@modules/payroll/core/app/use-cases/payroll/ListPayrollsUseCase";
import MarkPayrollPaidUseCase from "@modules/payroll/core/app/use-cases/payroll/MarkPayrollPaidUseCase";
import PayrollPreflightUseCase from "@modules/payroll/core/app/use-cases/payroll/PayrollPreflightUseCase";
import PayrollTotalsUseCase from "@modules/payroll/core/app/use-cases/payroll/PayrollTotalsUseCase";
import RevertPayrollUseCase from "@modules/payroll/core/app/use-cases/payroll/RevertPayrollUseCase";
import RunPayrollForEmployeeUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForEmployeeUseCase";
import RunPayrollForPeriodUseCase from "@modules/payroll/core/app/use-cases/payroll/RunPayrollForPeriodUseCase";
import CreateAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateAllowanceUseCase";
import CreateBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateBonusUseCase";
import CreateDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateDeductionUseCase";
import CreateSalaryPolicyUseCase from "@modules/payroll/core/app/use-cases/compensation/CreateSalaryPolicyUseCase";
import DeleteAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteAllowanceUseCase";
import DeleteBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteBonusUseCase";
import DeleteDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/DeleteDeductionUseCase";
import ListAllowancesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListAllowancesByEmployeeUseCase";
import ListBonusesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListBonusesByEmployeeUseCase";
import ListDeductionsByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListDeductionsByEmployeeUseCase";
import ListSalaryPoliciesUseCase from "@modules/payroll/core/app/use-cases/compensation/ListSalaryPoliciesUseCase";
import ListTaxProfilesByEmployeeUseCase from "@modules/payroll/core/app/use-cases/compensation/ListTaxProfilesByEmployeeUseCase";
import UpdateAllowanceUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateAllowanceUseCase";
import UpdateBonusUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateBonusUseCase";
import UpdateDeductionUseCase from "@modules/payroll/core/app/use-cases/compensation/UpdateDeductionUseCase";
import UpsertTaxProfileUseCase from "@modules/payroll/core/app/use-cases/compensation/UpsertTaxProfileUseCase";
import { createAttendanceDirectory } from "@modules/attendance";
import { createEmployeeDirectory } from "@modules/employee";
import { createIamAccessControl } from "@modules/iam";
import EventBus from "@shared/core/domain/EventBus";
import { Db as MongoDb, MongoClient } from "mongodb";

const WILDCARD_PERMISSION_KEY = "*";

/**
 * Lắp `PermissionChecker` của Payroll trên `IamAccessControlFacade` — cần
 * thêm `hasPermission` (không ném lỗi) cho phòng thủ theo chiều sâu ở
 * `GetPayrollUseCase` (nhân viên xem lương chính mình).
 */
function createPermissionChecker(mongoDb: MongoDb): PermissionChecker {
    const iam = createIamAccessControl(mongoDb);
    return {
        assertPermission: (actorUserId, permissionKey) => iam.assertPermission(actorUserId, permissionKey),
        hasPermission: async (actorUserId, permissionKey) => {
            const effective = await iam.listPermissionsOf(actorUserId);
            return effective.includes(permissionKey) || effective.includes(WILDCARD_PERMISSION_KEY);
        },
    };
}

/**
 * Lắp ráp use-case của module Payroll trên nền MongoDB — điểm nối
 * (composition root) giữa core, driven adapter, cổng nhân viên/chấm công và
 * cổng quyền hạn của IAM. `createEmployeeDirectory`/`createAttendanceDirectory`
 * khớp cấu trúc (structural typing) với `EmployeeDirectory`/`AttendanceDirectory`
 * riêng của Payroll — không cần cast tường minh.
 */
export default function createPayrollHttpUseCases(mongoClient: MongoClient, mongoDb: MongoDb, eventBus: EventBus): PayrollHttpUseCases {
    const uow            = new MongoUnitOfWork(mongoClient, mongoDb);
    const periodRepo      = new MongoPayrollPeriodRepo(mongoDb);
    const payslipRepo     = new MongoPayslipRepo(mongoDb);
    const allowanceRepo   = new MongoAllowanceRepo(mongoDb);
    const bonusRepo       = new MongoBonusRepo(mongoDb);
    const deductionRepo   = new MongoDeductionRepo(mongoDb);
    const taxProfileRepo  = new MongoTaxProfileRepo(mongoDb);
    const salaryPolicyRepo = new MongoSalaryPolicyRepo(mongoDb);

    const permissions        = createPermissionChecker(mongoDb);
    const employeeDirectory   = createEmployeeDirectory(mongoDb);
    const attendanceDirectory = createAttendanceDirectory(mongoDb);

    const runPayrollForEmployee = new RunPayrollForEmployeeUseCase(
        permissions, uow, employeeDirectory, attendanceDirectory, salaryPolicyRepo,
        allowanceRepo, bonusRepo, deductionRepo, taxProfileRepo,
    );
    const runPayrollForPeriod = new RunPayrollForPeriodUseCase(permissions, employeeDirectory, runPayrollForEmployee);

    // Late-bound port so lock use-cases can trigger a full-period run without
    // depending on the concrete class directly.
    const payrollRunPort: PayrollRunPort = {
        forPeriod: (periodId, actorUserId) => runPayrollForPeriod.execute({ periodId, actorUserId }),
    };

    return {
        permissions,

        // PayrollPeriod
        createPayrollPeriod: new CreatePayrollPeriodUseCase(permissions, periodRepo),
        updatePayrollPeriod: new UpdatePayrollPeriodUseCase(permissions, periodRepo),
        getPayrollPeriod:    new GetPayrollPeriodUseCase(periodRepo),
        listPayrollPeriods:  new ListPayrollPeriodsUseCase(periodRepo),
        closePayrollPeriod:  new ClosePayrollPeriodUseCase(permissions, periodRepo, payslipRepo),
        reopenPayrollPeriod: new ReopenPayrollPeriodUseCase(permissions, periodRepo, payslipRepo),
        deletePayrollPeriod: new DeletePayrollPeriodUseCase(permissions, periodRepo, payslipRepo),
        attendanceReadiness: new AttendanceReadinessUseCase(periodRepo, employeeDirectory, attendanceDirectory),
        lockAttendance:      new LockAttendanceUseCase(permissions, periodRepo, eventBus, payrollRunPort),
        unlockAttendance:    new UnlockAttendanceUseCase(permissions, periodRepo, payslipRepo),
        evaluationReadiness: new EvaluationReadinessUseCase(periodRepo, employeeDirectory),
        lockEvaluations:     new LockEvaluationsUseCase(permissions, periodRepo, payrollRunPort),
        unlockEvaluations:   new UnlockEvaluationsUseCase(permissions, periodRepo, payslipRepo),
        runPayrollForPeriod,
        runPayrollForEmployee,

        // Payroll (payslip)
        listPayrolls:        new ListPayrollsUseCase(payslipRepo),
        getPayroll:          new GetPayrollUseCase(payslipRepo, employeeDirectory),
        listMyPayrolls:      new ListMyPayrollsUseCase(payslipRepo, employeeDirectory, periodRepo),
        payrollTotals:       new PayrollTotalsUseCase(payslipRepo),
        payrollPreflight:    new PayrollPreflightUseCase(periodRepo, employeeDirectory, salaryPolicyRepo),
        exportPayrollPeriod: new ExportPayrollPeriodUseCase(payslipRepo),
        grossUp:             new GrossUpUseCase(salaryPolicyRepo),
        approvePayroll:      new ApprovePayrollUseCase(permissions, uow, eventBus),
        revertPayroll:       new RevertPayrollUseCase(permissions, payslipRepo),
        markPayrollPaid:     new MarkPayrollPaidUseCase(permissions, uow, eventBus),

        // Allowance
        createAllowance: new CreateAllowanceUseCase(permissions, allowanceRepo),
        updateAllowance: new UpdateAllowanceUseCase(permissions, allowanceRepo),
        deleteAllowance: new DeleteAllowanceUseCase(permissions, allowanceRepo),
        listAllowancesByEmployee: new ListAllowancesByEmployeeUseCase(allowanceRepo),

        // Bonus
        createBonus: new CreateBonusUseCase(permissions, bonusRepo),
        updateBonus: new UpdateBonusUseCase(permissions, bonusRepo),
        deleteBonus: new DeleteBonusUseCase(permissions, bonusRepo),
        listBonusesByEmployee: new ListBonusesByEmployeeUseCase(bonusRepo),

        // Deduction
        createDeduction: new CreateDeductionUseCase(permissions, deductionRepo),
        updateDeduction: new UpdateDeductionUseCase(permissions, deductionRepo),
        deleteDeduction: new DeleteDeductionUseCase(permissions, deductionRepo),
        listDeductionsByEmployee: new ListDeductionsByEmployeeUseCase(deductionRepo),

        // TaxProfile
        upsertTaxProfile: new UpsertTaxProfileUseCase(permissions, taxProfileRepo),
        listTaxProfilesByEmployee: new ListTaxProfilesByEmployeeUseCase(taxProfileRepo),

        // SalaryPolicy
        createSalaryPolicy: new CreateSalaryPolicyUseCase(permissions, salaryPolicyRepo),
        listSalaryPolicies: new ListSalaryPoliciesUseCase(salaryPolicyRepo),
    };
}
