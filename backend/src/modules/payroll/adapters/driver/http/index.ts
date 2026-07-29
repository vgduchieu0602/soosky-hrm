import AllowanceController, { AllowanceControllerUseCases } from "@modules/payroll/adapters/driver/http/controllers/AllowanceController";
import BonusController, { BonusControllerUseCases } from "@modules/payroll/adapters/driver/http/controllers/BonusController";
import DeductionController, { DeductionControllerUseCases } from "@modules/payroll/adapters/driver/http/controllers/DeductionController";
import PayrollController, { PayrollControllerUseCases } from "@modules/payroll/adapters/driver/http/controllers/PayrollController";
import PayrollPeriodController, { PayrollPeriodControllerUseCases } from "@modules/payroll/adapters/driver/http/controllers/PayrollPeriodController";
import SalaryPolicyController, { SalaryPolicyControllerUseCases } from "@modules/payroll/adapters/driver/http/controllers/SalaryPolicyController";
import TaxProfileController, { TaxProfileControllerUseCases } from "@modules/payroll/adapters/driver/http/controllers/TaxProfileController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/** Toàn bộ use-case mà driver adapter HTTP của module Payroll cần. */
export type PayrollHttpUseCases =
    & PayrollPeriodControllerUseCases
    & PayrollControllerUseCases
    & AllowanceControllerUseCases
    & BonusControllerUseCases
    & DeductionControllerUseCases
    & TaxProfileControllerUseCases
    & SalaryPolicyControllerUseCases;

/**
 * Driver adapter HTTP của module Payroll. Giữ danh sách route duy nhất —
 * nhìn một chỗ thấy toàn bộ bề mặt API: parse JSON body, xác thực Bearer
 * token, định tuyến tới controller, dịch lỗi thành `{ code, message }`.
 */
export function createPayrollHttpRouter(
    useCases: PayrollHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const periodController        = new PayrollPeriodController(useCases);
    const payrollController       = new PayrollController(useCases);
    const allowanceController     = new AllowanceController(useCases);
    const bonusController         = new BonusController(useCases);
    const deductionController     = new DeductionController(useCases);
    const taxProfileController    = new TaxProfileController(useCases);
    const salaryPolicyController  = new SalaryPolicyController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    // PayrollPeriod
    router.post  ("/periods",                                    periodController.createPeriod);
    router.get   ("/periods",                                    periodController.listPeriods);
    router.get   ("/periods/:periodId",                          periodController.getPeriod);
    router.patch ("/periods/:periodId",                          periodController.updatePeriod);
    router.post  ("/periods/:periodId/close",                    periodController.closePeriod);
    router.post  ("/periods/:periodId/reopen",                   periodController.reopenPeriod);
    router.delete("/periods/:periodId",                          periodController.deletePeriod);
    router.get   ("/periods/:periodId/attendance-readiness",     periodController.attendanceReadiness);
    router.post  ("/periods/:periodId/lock-attendance",          periodController.lockAttendance);
    router.post  ("/periods/:periodId/unlock-attendance",        periodController.unlockAttendance);
    router.get   ("/periods/:periodId/evaluation-readiness",     periodController.evaluationReadiness);
    router.post  ("/periods/:periodId/lock-evaluations",         periodController.lockEvaluations);
    router.post  ("/periods/:periodId/unlock-evaluations",       periodController.unlockEvaluations);
    router.post  ("/periods/:periodId/run",                      periodController.runForPeriod);
    router.post  ("/periods/:periodId/run/:employeeId",          periodController.runForEmployee);

    // Payroll (payslip)
    router.get   ("/payrolls",              payrollController.listPayrolls);
    router.get   ("/payrolls/me",           payrollController.listMyPayrolls);
    router.get   ("/payrolls/:payrollId",   payrollController.getPayroll);
    router.get   ("/periods/:periodId/totals",    payrollController.payrollTotals);
    router.get   ("/periods/:periodId/preflight", payrollController.payrollPreflight);
    router.get   ("/periods/:periodId/export",    payrollController.exportPayrollPeriod);
    router.post  ("/gross-up",              payrollController.grossUp);
    router.post  ("/periods/:periodId/approve",   payrollController.approvePayroll);
    router.post  ("/payrolls/:payrollId/revert",  payrollController.revertPayroll);
    router.post  ("/periods/:periodId/mark-paid", payrollController.markPayrollPaid);

    // Allowance
    router.get   ("/employees/:employeeId/allowances", allowanceController.listAllowancesByEmployee);
    router.post  ("/allowances",             allowanceController.createAllowance);
    router.patch ("/allowances/:allowanceId", allowanceController.updateAllowance);
    router.delete("/allowances/:allowanceId", allowanceController.deleteAllowance);

    // Bonus
    router.get   ("/employees/:employeeId/bonuses", bonusController.listBonusesByEmployee);
    router.post  ("/bonuses",             bonusController.createBonus);
    router.patch ("/bonuses/:bonusId",    bonusController.updateBonus);
    router.delete("/bonuses/:bonusId",    bonusController.deleteBonus);

    // Deduction
    router.get   ("/employees/:employeeId/deductions", deductionController.listDeductionsByEmployee);
    router.post  ("/deductions",             deductionController.createDeduction);
    router.patch ("/deductions/:deductionId", deductionController.updateDeduction);
    router.delete("/deductions/:deductionId", deductionController.deleteDeduction);

    // TaxProfile
    router.get   ("/employees/:employeeId/tax-profiles", taxProfileController.listTaxProfilesByEmployee);
    router.post  ("/tax-profiles",           taxProfileController.upsertTaxProfile);

    // SalaryPolicy
    router.get   ("/policies", salaryPolicyController.listSalaryPolicies);
    router.post  ("/policies", salaryPolicyController.createSalaryPolicy);

    router.use(errorHandler);

    return router;
}
