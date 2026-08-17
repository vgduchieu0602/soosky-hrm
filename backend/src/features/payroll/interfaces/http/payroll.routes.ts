import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { requireRoles } from '@shared/middlewares/require-role';
import { validate } from '@shared/middlewares/validate';
import {
  payrollPeriodController,
  compensationController,
  payrollController,
} from '@features/payroll/interfaces/http/controllers';
import {
  createPeriodDto,
  updatePeriodDto,
  runPeriodDto,
  approvePayrollDto,
} from '@features/payroll/dto/payroll-period.dto';
import {
  createAllowanceDto,
  updateAllowanceDto,
  createBonusDto,
  updateBonusDto,
  createDeductionDto,
  updateDeductionDto,
  upsertTaxProfileDto,
} from '@features/payroll/dto/compensation.dto';
import { grossUpDto } from '@features/payroll/dto/gross-up.dto';

const router = Router();
const hrOrAdmin = requireRoles('admin', 'hr_manager');
const adminOnly = requireRoles('admin');

// ---- Payroll periods ----
router.get('/payroll/periods', authenticate, hrOrAdmin, payrollPeriodController.list);
router.get('/payroll/periods/:id', authenticate, hrOrAdmin, payrollPeriodController.get);
router.post('/payroll/periods', authenticate, hrOrAdmin, validate(createPeriodDto, 'body'), payrollPeriodController.create);
router.patch('/payroll/periods/:id', authenticate, hrOrAdmin, validate(updatePeriodDto, 'body'), payrollPeriodController.update);
router.post('/payroll/periods/:id/close', authenticate, hrOrAdmin, payrollPeriodController.close);
router.post('/payroll/periods/:id/reopen', authenticate, adminOnly, payrollPeriodController.reopen);
router.delete('/payroll/periods/:id', authenticate, hrOrAdmin, payrollPeriodController.remove);
router.get('/payroll/periods/:id/attendance-readiness', authenticate, hrOrAdmin, payrollPeriodController.attendanceReadiness);
router.post('/payroll/periods/:id/lock-attendance', authenticate, hrOrAdmin, payrollPeriodController.lockAttendance);
router.post('/payroll/periods/:id/unlock-attendance', authenticate, hrOrAdmin, payrollPeriodController.unlockAttendance);
router.get('/payroll/periods/:id/performance-readiness', authenticate, hrOrAdmin, payrollPeriodController.performanceReadiness);
router.post('/payroll/periods/:id/lock-performance', authenticate, hrOrAdmin, payrollPeriodController.lockPerformance);
router.post('/payroll/periods/:id/unlock-performance', authenticate, hrOrAdmin, payrollPeriodController.unlockPerformance);

// ---- Payroll run triggers ----
router.post('/payroll/periods/:id/run', authenticate, hrOrAdmin, validate(runPeriodDto, 'body'), payrollPeriodController.runPeriod);
router.post('/payroll/periods/:id/run/:employeeId', authenticate, hrOrAdmin, payrollPeriodController.runEmployee);

// ---- Computed payrolls ----
router.get('/payroll/payrolls/me', authenticate, payrollController.mine);
router.get('/payroll/payrolls', authenticate, hrOrAdmin, payrollController.list);
router.get('/payroll/payrolls/:id', authenticate, hrOrAdmin, payrollController.get);
router.get('/payroll/periods/:periodId/totals', authenticate, hrOrAdmin, payrollController.totals);
router.get('/payroll/periods/:periodId/preflight', authenticate, hrOrAdmin, payrollController.preflight);
router.get('/payroll/periods/:periodId/export', authenticate, hrOrAdmin, payrollController.exportPeriod);

// ---- Workflow: approve (HR/Admin) → mark-paid (Admin) ----
router.post('/payroll/periods/:id/approve', authenticate, hrOrAdmin, validate(approvePayrollDto, 'body'), payrollController.approve);
router.post('/payroll/payrolls/:id/revert', authenticate, hrOrAdmin, payrollController.revert);
router.post('/payroll/periods/:id/mark-paid', authenticate, adminOnly, payrollController.markPaid);

// ---- Allowances (per employee) ----
router.get('/payroll/employees/:employeeId/allowances', authenticate, hrOrAdmin, compensationController.listAllowances);
router.post('/payroll/allowances', authenticate, hrOrAdmin, validate(createAllowanceDto, 'body'), compensationController.createAllowance);
router.patch('/payroll/allowances/:id', authenticate, hrOrAdmin, validate(updateAllowanceDto, 'body'), compensationController.updateAllowance);
router.delete('/payroll/allowances/:id', authenticate, hrOrAdmin, compensationController.removeAllowance);

// ---- Bonuses ----
router.get('/payroll/employees/:employeeId/bonuses', authenticate, hrOrAdmin, compensationController.listBonuses);
router.post('/payroll/bonuses', authenticate, hrOrAdmin, validate(createBonusDto, 'body'), compensationController.createBonus);
router.patch('/payroll/bonuses/:id', authenticate, hrOrAdmin, validate(updateBonusDto, 'body'), compensationController.updateBonus);
router.delete('/payroll/bonuses/:id', authenticate, hrOrAdmin, compensationController.removeBonus);

// ---- Deductions ----
router.get('/payroll/employees/:employeeId/deductions', authenticate, hrOrAdmin, compensationController.listDeductions);
router.post('/payroll/deductions', authenticate, hrOrAdmin, validate(createDeductionDto, 'body'), compensationController.createDeduction);
router.patch('/payroll/deductions/:id', authenticate, hrOrAdmin, validate(updateDeductionDto, 'body'), compensationController.updateDeduction);
router.delete('/payroll/deductions/:id', authenticate, hrOrAdmin, compensationController.removeDeduction);

// ---- NET → GROSS calculator ----
router.post('/payroll/gross-up', authenticate, hrOrAdmin, validate(grossUpDto, 'body'), payrollController.grossUp);

// ---- Tax profiles ----
router.get('/payroll/employees/:employeeId/tax-profiles', authenticate, hrOrAdmin, compensationController.listTaxProfiles);
router.post('/payroll/tax-profiles', authenticate, hrOrAdmin, validate(upsertTaxProfileDto, 'body'), compensationController.upsertTaxProfile);

export default router;
