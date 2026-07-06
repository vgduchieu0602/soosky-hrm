import { Employee } from '@shared/models/employee.model';
import { Payroll } from '@shared/models/payroll.model';
import { MonthlyEvaluation } from '@shared/models/monthly-evaluation.model';
import { Role } from '@shared/models/role.model';
import { UserRole } from '@shared/models/user-role.model';
import type {
  EmployeeGateway,
  EvaluationGateway,
  Id,
  PayrollGateway,
  RoleGateway,
} from '@features/notification/domain/ports';

export class MongooseRoleGateway implements RoleGateway {
  async userIdsByRoles(roleNames: string[]): Promise<string[]> {
    const roles = await Role.find({ name: { $in: roleNames } }).select('_id').lean();
    if (roles.length === 0) return [];
    const links = await UserRole.find({ roleId: { $in: roles.map((r) => r._id) } })
      .select('userId')
      .lean();
    return [...new Set(links.map((l) => String(l.userId)))];
  }
}

export class MongooseEmployeeGateway implements EmployeeGateway {
  async userIdOfEmployee(employeeId: Id): Promise<string | null> {
    const e = await Employee.findById(employeeId).select('userId').lean();
    return e?.userId ? String(e.userId) : null;
  }

  async employeeCode(employeeId: Id): Promise<string | null> {
    const e = await Employee.findById(employeeId).select('employeeCode').lean();
    return e?.employeeCode ?? null;
  }

  countActive(): Promise<number> {
    return Employee.countDocuments({ status: { $ne: 'terminated' } });
  }
}

export class MongoosePayrollGateway implements PayrollGateway {
  async userIdsForPeriod(periodId: Id): Promise<string[]> {
    const payrolls = await Payroll.find({ payrollPeriodId: periodId }).select('employeeId').lean();
    if (payrolls.length === 0) return [];
    const employees = await Employee.find({ _id: { $in: payrolls.map((p) => p.employeeId) } })
      .select('userId')
      .lean();
    return employees
      .map((e) => e.userId)
      .filter(Boolean)
      .map((u) => String(u));
  }
}

export class MongooseEvaluationGateway implements EvaluationGateway {
  countApprovedForPeriod(periodId: Id): Promise<number> {
    return MonthlyEvaluation.countDocuments({
      payrollPeriodId: periodId,
      status: { $in: ['approved', 'acknowledged'] },
    });
  }
}
