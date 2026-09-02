import mongoose from 'mongoose';
import { MonthlyEvaluation } from '@modules/hrm/adapters/persistence/mongoose/models/monthly-evaluation.model';
import { NotFoundError } from '@shared/errors/not-found.error';
import type { ScoreInput } from '@modules/hrm/core/performance/domain/evaluation-ratio';
import type {
  EvaluationRepository,
  EvaluationRecord,
  EvaluationUpsertFields,
  Id,
} from '@modules/hrm/core/performance/domain/ports';

const toScores = (rows: ScoreInput[]) =>
  rows.map((s) => ({ criterionId: new mongoose.Types.ObjectId(s.criterionId), score: s.score }));
const toDefinitions = (rows: NonNullable<EvaluationUpsertFields['criteriaDefinitionSnapshot']>) =>
  rows.map((criterion) => ({
    criterionId: new mongoose.Types.ObjectId(criterion.criterionId),
    name: criterion.name,
    group: criterion.group,
    weight: criterion.weight,
  }));

export class MongooseEvaluationRepository implements EvaluationRepository {
  list(payrollPeriodId?: string): Promise<EvaluationRecord[]> {
    const filter: Record<string, unknown> = {};
    if (payrollPeriodId && mongoose.Types.ObjectId.isValid(payrollPeriodId)) {
      filter.payrollPeriodId = payrollPeriodId;
    }
    return MonthlyEvaluation.find(filter).sort({ updated_at: -1 }).lean() as unknown as Promise<EvaluationRecord[]>;
  }

  findByEmployee(employeeId: Id): Promise<EvaluationRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) return Promise.resolve([]);
    return MonthlyEvaluation.find({ employeeId }).sort({ updated_at: -1 }).lean() as unknown as Promise<EvaluationRecord[]>;
  }

  async findById(id: Id): Promise<EvaluationRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await MonthlyEvaluation.findById(id);
    return doc ? (doc.toJSON() as unknown as EvaluationRecord) : null;
  }

  async findByEmployeePeriod(employeeId: Id, payrollPeriodId: Id): Promise<EvaluationRecord | null> {
    const doc = await MonthlyEvaluation.findOne({ employeeId, payrollPeriodId }).lean();
    return (doc as unknown as EvaluationRecord) ?? null;
  }

  async upsert(employeeId: Id, payrollPeriodId: Id, fields: EvaluationUpsertFields): Promise<EvaluationRecord> {
    const set: Record<string, unknown> = {
      criteriaScores: toScores(fields.criteriaScores),
      managerScores: toScores(fields.criteriaScores),
      ...(fields.criteriaDefinitionSnapshot
        ? { criteriaDefinitionSnapshot: toDefinitions(fields.criteriaDefinitionSnapshot) }
        : {}),
      performanceRatio: fields.performanceRatio,
      goalResult: fields.goalResult,
      goalRatio: fields.goalRatio,
      strengths: fields.strengths,
      improvements: fields.improvements,
      developmentPlan: fields.developmentPlan,
      managerId: fields.managerId ?? null,
      evaluatedBy: new mongoose.Types.ObjectId(fields.evaluatedBy),
      status: fields.status,
      approvedAt: fields.approvedAt,
    };
    const doc = await MonthlyEvaluation.findOneAndUpdate(
      { employeeId, payrollPeriodId },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return doc!.toJSON() as unknown as EvaluationRecord;
  }

  async acknowledge(
    id: Id,
    patch: { acknowledgedAt: Date; acknowledgedBy: Id; disputeNote: string | null },
  ): Promise<EvaluationRecord> {
    const doc = await MonthlyEvaluation.findById(id);
    if (!doc) throw new NotFoundError('Evaluation');
    doc.status = 'acknowledged';
    doc.acknowledgedAt = patch.acknowledgedAt;
    doc.acknowledgedBy = new mongoose.Types.ObjectId(patch.acknowledgedBy);
    doc.disputeNote = patch.disputeNote;
    await doc.save();
    return doc.toJSON() as unknown as EvaluationRecord;
  }

  async reopen(id: Id): Promise<EvaluationRecord> {
    const doc = await MonthlyEvaluation.findById(id);
    if (!doc) throw new NotFoundError('Evaluation');
    doc.status = 'draft';
    doc.approvedAt = null;
    await doc.save();
    return doc.toJSON() as unknown as EvaluationRecord;
  }

  exportRows(payrollPeriodId?: string): Promise<Record<string, unknown>[]> {
    const match: Record<string, unknown> = {};
    if (payrollPeriodId && mongoose.Types.ObjectId.isValid(payrollPeriodId)) {
      match.payrollPeriodId = new mongoose.Types.ObjectId(payrollPeriodId);
    }
    return MonthlyEvaluation.aggregate([
      { $match: match },
      { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'emp' } },
      { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'employeeProfiles', localField: 'employeeId', foreignField: 'employeeId', as: 'profile' } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'departments', localField: 'emp.departmentId', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'payrollPeriods', localField: 'payrollPeriodId', foreignField: '_id', as: 'period' } },
      { $unwind: { path: '$period', preserveNullAndEmptyArrays: true } },
      { $sort: { 'period.name': -1, 'emp.employeeCode': 1 } },
    ]);
  }
}
