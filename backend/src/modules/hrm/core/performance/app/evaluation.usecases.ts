/**
 * Direct HR/manager evaluation engine (application layer — ports only).
 *
 *   draft        → đã chấm, lưu nháp (sửa được, chưa nuôi lương)
 *   approved     → đã duyệt (payroll tiêu thụ từ đây; performanceRatio/goalRatio)
 *   acknowledged → NV xác nhận kết quả
 */
import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import { ForbiddenError } from '@shared/errors/forbidden.error';
import { computeEvaluationRatio, unscoredIn } from '@modules/hrm/core/performance/domain/evaluation-ratio';
import type {
  EvaluationRepository,
  EmployeeGateway,
  CriterionGateway,
  PayrollLockGateway,
  AuditPort,
  EventsPort,
  Clock,
  EvaluationRecord,
  CriterionDefinition,
} from '@modules/hrm/core/performance/domain/ports';
import type { DirectEvaluateDto } from '@modules/hrm/core/performance/dto/evaluation.dto';

const log = logger.child({ feature: 'performance', module: 'evaluation' });
const conflict = (message: string, code = 'EVAL_409') => new HttpError(409, message, code);

function snapshotFromRecord(record: EvaluationRecord): CriterionDefinition[] | null {
  const raw = record.criteriaDefinitionSnapshot;
  if (!Array.isArray(raw)) return null;
  const definitions = raw.flatMap((value): CriterionDefinition[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (
      (item.group !== 'performance' && item.group !== 'goal') ||
      typeof item.name !== 'string' ||
      typeof item.weight !== 'number' ||
      item.criterionId == null
    ) return [];
    return [{ criterionId: String(item.criterionId), name: item.name, group: item.group, weight: item.weight }];
  });
  return definitions.length === raw.length ? definitions : null;
}

function weightsAreValid(definitions: CriterionDefinition[], group: CriterionDefinition['group']): boolean {
  const groupDefinitions = definitions.filter((definition) => definition.group === group);
  const total = groupDefinitions.reduce((sum, definition) => sum + definition.weight, 0);
  return groupDefinitions.length === 0 || Math.abs(total - 100) < 0.000001;
}

export class EvaluationUseCases {
  constructor(
    private readonly repo: EvaluationRepository,
    private readonly employees: EmployeeGateway,
    private readonly criteria: CriterionGateway,
    private readonly payrollLock: PayrollLockGateway,
    private readonly audit: AuditPort,
    private readonly events: EventsPort,
    private readonly clock: Clock,
  ) {}

  private async load(id: string): Promise<EvaluationRecord> {
    const doc = await this.repo.findById(id);
    if (!doc) throw new NotFoundError('Evaluation');
    return doc;
  }

  list(payrollPeriodId?: string) {
    return this.repo.list(payrollPeriodId);
  }

  /**
   * Fetch one evaluation. A non-HR caller may only read their OWN evaluation —
   * prevents an employee from reading someone else's scores/notes by guessing id.
   */
  async get(id: string, viewer?: { userId: string; isHrOrAdmin: boolean }) {
    const doc = await this.load(id);
    if (viewer && !viewer.isHrOrAdmin) {
      const empId = await this.employees.findEmployeeIdByUserId(viewer.userId);
      if (empId !== String(doc.employeeId)) throw new ForbiddenError();
    }
    return doc;
  }

  /** HR: one employee's evaluations across all periods (history/trend). */
  listByEmployee(employeeId: string) {
    return this.repo.findByEmployee(employeeId);
  }

  /** Self-service: the acting employee's own (finalized) evaluations. */
  async listMine(userId: string) {
    const employeeId = await this.employees.findEmployeeIdByUserId(userId);
    if (!employeeId) return [];
    return this.repo.findByEmployee(employeeId);
  }

  /**
   * Direct evaluate: upsert one employee's evaluation for a period and either
   * save as draft or finalize (approved). No separate "initiate" step.
   * When finalizing, both criterion groups must total exactly 100%.
   */
  async directEvaluate(input: DirectEvaluateDto, hrUserId: string) {
    const finalize = input.finalize === true;

    if (await this.payrollLock.isPerformancePeriodLocked?.(input.payrollPeriodId)) {
      throw conflict('Kỳ lương đã chốt đánh giá — không thể sửa điểm', 'PERFORMANCE_PERIOD_LOCKED');
    }

    const employee = await this.employees.findManager(input.employeeId);
    if (!employee) throw new NotFoundError('Employee');

    const existing = await this.repo.findByEmployeePeriod(input.employeeId, input.payrollPeriodId);
    if (existing?.status === 'acknowledged') {
      throw conflict('Nhân viên đã xác nhận, không thể sửa', 'EVAL_ACKED');
    }

    if (finalize && input.criteriaScores.length === 0) {
      throw conflict('Chưa có điểm để duyệt', 'EVAL_NO_SCORES');
    }

    // Ratio = SIMPLE AVERAGE of each group's sub-indicators (no weights).
    const definitions =
      (existing ? snapshotFromRecord(existing) : null) ??
      (await this.criteria.activeDefinitions());
    const types = {
      performance: new Set(definitions.filter((definition) => definition.group === 'performance').map((definition) => definition.criterionId)),
      goal: new Set(definitions.filter((definition) => definition.group === 'goal').map((definition) => definition.criterionId)),
    };

    // Guard against silent under-pay: finalizing with a whole group left
    // unscored would average to 0 and zero out that salary band (perf 60% /
    // goal 20%). Require every active criterion in each group to be scored.
    if (finalize) {
      const scored = new Set(input.criteriaScores.map((s) => String(s.criterionId)));
      if (!weightsAreValid(definitions, 'performance') || !weightsAreValid(definitions, 'goal')) {
        throw conflict('Invalid criterion weight configuration', 'EVAL_INVALID_CRITERIA_WEIGHTS');
      }
      if (types.performance.size > 0 && unscoredIn(types.performance, scored).length > 0) {
        throw conflict('Chưa chấm đủ chỉ số nhóm Hiệu suất', 'EVAL_INCOMPLETE_PERFORMANCE');
      }
      if (types.goal.size > 0 && unscoredIn(types.goal, scored).length > 0) {
        throw conflict('Chưa chấm đủ chỉ số nhóm Mục tiêu', 'EVAL_INCOMPLETE_GOAL');
      }
    }

    const performanceRatio = computeEvaluationRatio(
      input.criteriaScores,
      new Map(definitions.filter((definition) => definition.group === 'performance').map((definition) => [definition.criterionId, definition.weight])),
    );
    const goalRatio = computeEvaluationRatio(
      input.criteriaScores,
      new Map(definitions.filter((definition) => definition.group === 'goal').map((definition) => [definition.criterionId, definition.weight])),
    );

    const doc = await this.repo.upsert(input.employeeId, input.payrollPeriodId, {
      criteriaScores: input.criteriaScores,
      criteriaDefinitionSnapshot: definitions.map((definition) => ({ ...definition })),
      performanceRatio,
      goalResult: goalRatio,
      goalRatio,
      strengths: input.strengths ?? null,
      improvements: input.improvements ?? null,
      developmentPlan: input.developmentPlan ?? null,
      managerId: employee.managerId ?? null,
      evaluatedBy: hrUserId,
      status: finalize ? 'approved' : 'draft',
      approvedAt: finalize ? this.clock.now() : null,
    });

    await this.audit.record({
      userId: hrUserId,
      resource: 'monthlyEvaluation',
      action: existing ? 'update' : 'create',
      resourceId: String(doc._id),
      changes: { status: finalize ? 'approved' : 'draft', performanceRatio, goalRatio },
    });
    log.info({ action: 'direct-evaluate', employeeId: input.employeeId, finalize, performanceRatio, goalRatio });
    if (finalize) {
      this.events.evaluationFinalized({
        employeeId: String(input.employeeId),
        payrollPeriodId: String(input.payrollPeriodId),
      });
    }
    return doc;
  }

  /** approved → acknowledged. Only the employee; may attach a dispute note. */
  async acknowledge(id: string, disputeNote: string | undefined, userId: string) {
    const doc = await this.load(id);
    if (doc.status !== 'approved') throw conflict(`Chưa duyệt để xác nhận (hiện: ${doc.status})`, 'EVAL_NOT_APPROVED');
    const empId = await this.employees.findEmployeeIdByUserId(userId);
    if (empId !== String(doc.employeeId)) throw new ForbiddenError();
    const updated = await this.repo.acknowledge(id, {
      acknowledgedAt: this.clock.now(),
      acknowledgedBy: userId,
      disputeNote: disputeNote ?? null,
    });
    await this.audit.record({
      userId,
      resource: 'monthlyEvaluation',
      action: 'update',
      resourceId: id,
      changes: { status: 'acknowledged', dispute: !!disputeNote },
    });
    if (disputeNote) {
      this.events.evaluationDisputed({ employeeId: String(doc.employeeId), evaluationId: id });
    }
    return updated;
  }

  /** approved → draft (re-open to edit before payroll uses it). HR only. */
  async reopen(id: string, hrUserId: string, reason?: string) {
    const doc = await this.load(id);
    if (doc.status !== 'approved') throw conflict('Chỉ mở lại bản đã duyệt', 'EVAL_NOT_APPROVED');
    if (await this.payrollLock.isPerformancePeriodLocked?.(String(doc.payrollPeriodId))) {
      throw conflict('Kỳ lương đã chốt đánh giá — không thể mở lại', 'PERFORMANCE_PERIOD_LOCKED');
    }
    // Refuse if payroll has already locked this evaluation's ratios into a
    // finalized payslip — reopening would let HR change scores that an
    // approved/paid payroll already snapshotted, silently diverging the two.
    const lockedPayroll = await this.payrollLock.findLockedPayroll(
      String(doc.payrollPeriodId),
      String(doc.employeeId),
    );
    if (lockedPayroll) {
      throw conflict(
        `Bảng lương của kỳ này đã ${lockedPayroll.status === 'paid' ? 'thanh toán' : 'duyệt'} — không thể mở lại đánh giá. Hãy hoàn tác bảng lương trước.`,
        'EVAL_PAYROLL_LOCKED',
      );
    }
    const updated = await this.repo.reopen(id);
    await this.audit.record({
      userId: hrUserId,
      resource: 'monthlyEvaluation',
      action: 'update',
      resourceId: id,
      changes: { status: 'draft', reason: reason ?? null },
    });
    this.events.evaluationReopened({ employeeId: String(doc.employeeId) });
    return updated;
  }

  /** Export evaluations (optionally for one period) as a styled .xlsx buffer. */
  async exportXlsx(payrollPeriodId?: string): Promise<Buffer> {
    const rows = await this.repo.exportRows(payrollPeriodId);

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
  }
}
