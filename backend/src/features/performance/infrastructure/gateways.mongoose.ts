import mongoose from 'mongoose';
import { Employee } from '@shared/models/employee.model';
import { PerformanceCriterion } from '@shared/models/performance-criterion.model';
import { Payroll } from '@shared/models/payroll.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import type {
  EmployeeGateway,
  CriterionGateway,
  PayrollLockGateway,
  Id,
} from '@features/performance/domain/ports';

export class MongooseEmployeeGateway implements EmployeeGateway {
  async findEmployeeIdByUserId(userId: Id): Promise<string | null> {
    const e = await Employee.findOne({ userId }).select('_id').lean();
    return e ? String(e._id) : null;
  }
  async findManager(employeeId: Id): Promise<{ managerId: string | null } | null> {
    const e = await Employee.findById(employeeId).select('managerId').lean();
    if (!e) return null;
    return { managerId: e.managerId ? String(e.managerId) : null };
  }
}

export class MongooseCriterionGateway implements CriterionGateway {
  async activeDefinitions() {
    const criteria = await PerformanceCriterion.find({ status: 'active' })
      .select('label type weight order')
      .sort({ type: 1, order: 1, _id: 1 })
      .lean();
    return criteria.map((criterion) => ({
      criterionId: String(criterion._id),
      name: criterion.label,
      group: criterion.type,
      weight: criterion.weight ?? 0,
    }));
  }
}

export class MongoosePayrollLockGateway implements PayrollLockGateway {
  async findLockedPayroll(payrollPeriodId: Id, employeeId: Id): Promise<{ status: string } | null> {
    const p = await Payroll.findOne({
      payrollPeriodId: new mongoose.Types.ObjectId(payrollPeriodId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      status: { $in: ['approved', 'paid'] },
    })
      .select('_id status')
      .lean();
    return p ? { status: String(p.status) } : null;
  }

  async isPerformancePeriodLocked(payrollPeriodId: Id): Promise<boolean> {
    const period = await PayrollPeriod.findById(payrollPeriodId).select('performanceLockedAt').lean();
    return !!period?.performanceLockedAt;
  }
}
