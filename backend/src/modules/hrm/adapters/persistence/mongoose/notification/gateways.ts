import { Employee } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { Payroll } from '@modules/hrm/adapters/persistence/mongoose/models/payroll.model';
import { MonthlyEvaluation } from '@modules/hrm/adapters/persistence/mongoose/models/monthly-evaluation.model';
import { iamDirectory } from '@modules/iam';
import type {
  EmployeeGateway,
  EvaluationGateway,
  Id,
  PayrollGateway,
  RoleGateway,
} from '@modules/hrm/core/notification/domain/ports';

export class MongooseRoleGateway implements RoleGateway {
  userIdsByRoles(roleNames: string[]): Promise<string[]> {
    return iamDirectory.userIdsByRoles(roleNames);
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
