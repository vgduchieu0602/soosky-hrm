/**
 * Direct HR/manager evaluation engine.
 *
 *   draft        → đã chấm, lưu nháp (sửa được, chưa nuôi lương)
 *   approved     → đã duyệt (payroll tiêu thụ từ đây; performanceRatio/goalRatio)
 *   acknowledged → NV xác nhận kết quả
 *
 * `performanceRatio` = weighted avg of `type=performance` criteria scores;
 * `goalRatio` = weighted avg of `type=goal` criteria scores.
 */
import mongoose from 'mongoose';

import { logger } from '@core/logger/logger';
import { eventBus } from '@core/events/event-bus';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import { ForbiddenError } from '@shared/errors/forbidden.error';
import { Employee } from '@shared/models/employee.model';
import {
  MonthlyEvaluation,
  type MonthlyEvaluationDoc,
} from '@shared/models/monthly-evaluation.model';
import { PerformanceCriterion } from '@shared/models/performance-criterion.model';
import { auditService } from '@features/iam/services/audit.service';
import { computePerformanceRatio } from '@shared/utils/salary.util';
import type { DirectEvaluateDto } from '@features/performance/dto/evaluation.dto';

const log = logger.child({ feature: 'performance', module: 'evaluation' });
const conflict = (message: string, code = 'EVAL_409') => new HttpError(409, message, code);

declare module '@core/events/event-bus' {
  interface AppEventMap {
    'evaluation.finalized': { employeeId: string; payrollPeriodId: string };
    'evaluation.reopened': { employeeId: string };
    'evaluation.disputed': { employeeId: string; evaluationId: string };
  }
}

export interface ScoreInput {
  criterionId: string;
  score: number;
}

/** Pure: weighted average of criteria scores (0–100) by criterion weight. */
export function computeEvaluationRatio(
  scores: ScoreInput[],
  weightByCriterionId: Map<string, number>,
): number {
  const weighted = scores.map((s) => ({
    weight: weightByCriterionId.get(String(s.criterionId)) ?? 0,
    score: s.score,
  }));
  return computePerformanceRatio(weighted);
}

/** Active criterion ids split by type — performance (60%) vs goal (20%). */
async function criterionTypeSets(): Promise<{ performance: Set<string>; goal: Set<string> }> {
  const criteria = await PerformanceCriterion.find({ status: 'active' }).select('type').lean();
  const performance = new Set<string>();
  const goal = new Set<string>();
  for (const c of criteria) {
    (c.type === 'goal' ? goal : performance).add(String(c._id));
  }
  return { performance, goal };
}

/** Simple average (0–100) of scores whose criterion belongs to `ids`. */
function simpleAverage(scores: ScoreInput[], ids: Set<string>): number {
  const sel = scores.filter((s) => ids.has(String(s.criterionId)));
  if (sel.length === 0) return 0;
  return Math.round(sel.reduce((a, s) => a + s.score, 0) / sel.length);
}

async function employeeIdOfUser(userId: string): Promise<string | null> {
  const e = await Employee.findOne({ userId }).select('_id').lean();
  return e ? String(e._id) : null;
}

const toScores = (rows: ScoreInput[]) =>
  rows.map((s) => ({ criterionId: new mongoose.Types.ObjectId(s.criterionId), score: s.score }));

async function load(id: string): Promise<MonthlyEvaluationDoc> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Evaluation');
  const doc = await MonthlyEvaluation.findById(id);
  if (!doc) throw new NotFoundError('Evaluation');
  return doc;
}

async function audit(userId: string, resourceId: string, changes: Record<string, unknown>) {
  await auditService.record({ userId, resource: 'monthlyEvaluation', action: 'update', resourceId, changes });
}

export const evaluationService = {
  list(payrollPeriodId?: string) {
    const filter: Record<string, unknown> = {};
    if (payrollPeriodId && mongoose.Types.ObjectId.isValid(payrollPeriodId)) {
      filter.payrollPeriodId = payrollPeriodId;
    }
    return MonthlyEvaluation.find(filter).sort({ updated_at: -1 }).lean();
  },

  /**
   * Fetch one evaluation. A non-HR caller may only read their OWN evaluation —
   * prevents an employee from reading someone else's scores/notes by guessing id.
   */
  async get(id: string, viewer?: { userId: string; isHrOrAdmin: boolean }) {
    const doc = await load(id);
    if (viewer && !viewer.isHrOrAdmin) {
      const empId = await employeeIdOfUser(viewer.userId);
      if (empId !== String(doc.employeeId)) throw new ForbiddenError();
    }
    return doc.toJSON();
  },

  /** HR: one employee's evaluations across all periods (history/trend). */
  listByEmployee(employeeId: string) {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) return Promise.resolve([]);
    return MonthlyEvaluation.find({ employeeId }).sort({ updated_at: -1 }).lean();
  },

  /** Self-service: the acting employee's own (finalized) evaluations. */
  async listMine(userId: string) {
    const employeeId = await employeeIdOfUser(userId);
    if (!employeeId) return [];
    return MonthlyEvaluation.find({ employeeId }).sort({ updated_at: -1 }).lean();
  },

  /**
   * Direct evaluate: upsert one employee's evaluation for a period and either
   * save as draft or finalize (approved). No separate "initiate" step.
   * When finalizing, both criterion groups must total exactly 100%.
   */
  async directEvaluate(input: DirectEvaluateDto, hrUserId: string) {
    const finalize = input.finalize === true;

    const employee = await Employee.findById(input.employeeId).select('managerId').lean();
    if (!employee) throw new NotFoundError('Employee');

    const existing = await MonthlyEvaluation.findOne({
      employeeId: input.employeeId,
      payrollPeriodId: input.payrollPeriodId,
    });
    if (existing?.status === 'acknowledged') {
      throw conflict('Nhân viên đã xác nhận, không thể sửa', 'EVAL_ACKED');
    }

    if (finalize && input.criteriaScores.length === 0) {
      throw conflict('Chưa có điểm để duyệt', 'EVAL_NO_SCORES');
    }

    // Ratio = SIMPLE AVERAGE of each group's sub-indicators (no weights).
    const types = await criterionTypeSets();
    const performanceRatio = simpleAverage(input.criteriaScores, types.performance);
    const goalRatio = simpleAverage(input.criteriaScores, types.goal);

    const set: Record<string, unknown> = {
      criteriaScores: toScores(input.criteriaScores),
      managerScores: toScores(input.criteriaScores),
      performanceRatio,
      goalResult: goalRatio,
      goalRatio,
      strengths: input.strengths ?? null,
      improvements: input.improvements ?? null,
      developmentPlan: input.developmentPlan ?? null,
      managerId: employee.managerId ?? null,
      evaluatedBy: new mongoose.Types.ObjectId(hrUserId),
      status: finalize ? 'approved' : 'draft',
      approvedAt: finalize ? new Date() : null,
    };

    const doc = await MonthlyEvaluation.findOneAndUpdate(
      { employeeId: input.employeeId, payrollPeriodId: input.payrollPeriodId },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await auditService.record({
      userId: hrUserId,
      resource: 'monthlyEvaluation',
      action: existing ? 'update' : 'create',
      resourceId: doc!._id.toString(),
      changes: { status: set.status, performanceRatio, goalRatio },
    });
    log.info({ action: 'direct-evaluate', employeeId: input.employeeId, finalize, performanceRatio, goalRatio });
    if (finalize) {
      eventBus.emit('evaluation.finalized', {
        employeeId: String(input.employeeId),
        payrollPeriodId: String(input.payrollPeriodId),
      });
    }
    return doc!.toJSON();
  },

  /** approved → acknowledged. Only the employee; may attach a dispute note. */
  async acknowledge(id: string, disputeNote: string | undefined, userId: string) {
    const doc = await load(id);
    if (doc.status !== 'approved') throw conflict(`Chưa duyệt để xác nhận (hiện: ${doc.status})`, 'EVAL_NOT_APPROVED');
    const empId = await employeeIdOfUser(userId);
    if (empId !== String(doc.employeeId)) throw new ForbiddenError();
    doc.status = 'acknowledged';
    doc.acknowledgedAt = new Date();
    doc.acknowledgedBy = new mongoose.Types.ObjectId(userId);
    doc.disputeNote = disputeNote ?? null;
    await doc.save();
    await audit(userId, id, { status: 'acknowledged', dispute: !!disputeNote });
    if (disputeNote) {
      eventBus.emit('evaluation.disputed', { employeeId: String(doc.employeeId), evaluationId: id });
    }
    return doc.toJSON();
  },

  /** approved → draft (re-open to edit before payroll uses it). HR only. */
  async reopen(id: string, hrUserId: string, reason?: string) {
    const doc = await load(id);
    if (doc.status !== 'approved') throw conflict('Chỉ mở lại bản đã duyệt', 'EVAL_NOT_APPROVED');
    doc.status = 'draft';
    doc.approvedAt = null;
    await doc.save();
    await audit(hrUserId, id, { status: 'draft', reason: reason ?? null });
    eventBus.emit('evaluation.reopened', { employeeId: String(doc.employeeId) });
    return doc.toJSON();
  },

  /** Export evaluations (optionally for one period) as a styled .xlsx buffer. */
  async exportXlsx(payrollPeriodId?: string): Promise<Buffer> {
    const match: Record<string, unknown> = {};
    if (payrollPeriodId && mongoose.Types.ObjectId.isValid(payrollPeriodId)) {
      match.payrollPeriodId = new mongoose.Types.ObjectId(payrollPeriodId);
    }
    const rows = await MonthlyEvaluation.aggregate([
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

    const STATUS_LABEL: Record<string, string> = {
      draft: 'Nháp', approved: 'Đã duyệt', acknowledged: 'NV đã xác nhận',
    };
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Soosky HRM';
    const ws = wb.addWorksheet('Đánh giá', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Mã NV', key: 'code', width: 14 },
      { header: 'Họ và tên', key: 'name', width: 26 },
      { header: 'Phòng ban', key: 'dept', width: 22 },
      { header: 'Kỳ', key: 'period', width: 12 },
      { header: 'Hiệu suất (%)', key: 'perf', width: 14 },
      { header: 'Mục tiêu (%)', key: 'goal', width: 14 },
      { header: 'Trạng thái', key: 'status', width: 16 },
      { header: 'Điểm mạnh', key: 'strengths', width: 34 },
      { header: 'Cần cải thiện', key: 'improvements', width: 34 },
      { header: 'Kế hoạch phát triển', key: 'developmentPlan', width: 34 },
    ];
    for (const r of rows as Record<string, any>[]) {
      const fullName = [r.profile?.lastName, r.profile?.middleName, r.profile?.firstName]
        .filter(Boolean)
        .join(' ');
      ws.addRow({
        code: r.emp?.employeeCode ?? '',
        name: fullName || r.emp?.employeeCode || '',
        dept: r.dept?.name ?? '',
        period: r.period?.name ?? '',
        perf: Math.round(r.performanceRatio ?? 0),
        goal: Math.round(r.goalRatio ?? 0),
        status: STATUS_LABEL[r.status] ?? r.status,
        strengths: r.strengths ?? '',
        improvements: r.improvements ?? '',
        developmentPlan: r.developmentPlan ?? '',
      });
    }
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 10 } };
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  },
};
