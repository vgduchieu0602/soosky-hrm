import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { vnDateKey, vnMonthRange, matchShifts, type ShiftWindow, type ShiftDef } from '@features/attendance/domain/attendance-calc';
import { computeFields, monthsSince } from '@features/attendance/domain/leave-policy';
import type { UpsertDayDto } from '@features/attendance/dto/attendance.dto';
import type {
  AttendanceRepository,
  EmployeeGateway,
  ShiftWindowGateway,
  PolicyGateway,
  PayrollLockGateway,
  AuditPort,
  Clock,
} from '@features/attendance/domain/ports';
import type { LeaveEntitlementService } from '@features/attendance/application/leave-entitlement.service';
import type { UpsertAttendanceDto, AdjustAttendanceDto } from '@features/attendance/dto/attendance.dto';

const log = logger.child({ feature: 'attendance', module: 'attendance' });

export class AttendanceUseCases {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly employees: EmployeeGateway,
    private readonly shifts: ShiftWindowGateway,
    private readonly policy: PolicyGateway,
    private readonly lock: PayrollLockGateway,
    private readonly audit: AuditPort,
    private readonly clock: Clock,
    private readonly entitlement: LeaveEntitlementService,
  ) {}

  private async assertUnlocked(date: Date): Promise<void> {
    const name = await this.lock.lockedPeriodName(date);
    if (name) throw new HttpError(409, `Kỳ ${name} đã chốt chấm công — không thể sửa`, 'ATT_LOCKED');
  }

  /** Employee self view — derives employee from the authenticated user. */
  async myMonth(userId: string, month: string) {
    const employee = await this.employees.findByUserId(userId);
    if (!employee) throw new HttpError(404, 'Không tìm thấy hồ sơ nhân viên', 'EMP_001');
    const { start, end } = vnMonthRange(month);
    const records = await this.attendance.findByEmployeeAndRange(employee._id, start, end);
    return { employeeId: employee._id, month, records };
  }

  /** Employee self check-in / check-out for today against the default shift. */
  async punch(userId: string, kind: 'in' | 'out') {
    const employee = await this.employees.findByUserId(userId);
    if (!employee) throw new HttpError(404, 'Không tìm thấy hồ sơ nhân viên', 'EMP_001');

    const shift = await this.shifts.findDefaultShiftWindow();
    if (!shift) throw new HttpError(400, 'Chưa cấu hình ca làm', 'ATT_005');

    const policy = await this.policy.loadPolicy();
    const now = this.clock.now();
    const dateKey = vnDateKey(now, policy.timezone);
    await this.assertUnlocked(dateKey);

    // Block punching on a day already covered by an approved full-day leave.
    const onLeave = await this.attendance.findFullDayLeave(employee._id, dateKey);
    if (onLeave) throw new HttpError(409, 'Bạn đang có đơn nghỉ phép đã duyệt trong ngày này', 'ATT_007');

    const window: ShiftWindow = { startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes };
    const existing = await this.attendance.findBySlot(employee._id, dateKey, shift.id);
    if (kind === 'out' && !existing?.checkIn) throw new HttpError(409, 'Chưa check-in hôm nay', 'ATT_006');

    const checkIn = kind === 'in' ? now : existing?.checkIn ?? null;
    const checkOut = kind === 'out' ? now : existing?.checkOut ?? null;
    const fields = computeFields(window, policy, { checkIn, checkOut });

    const doc = await this.attendance.upsertPunch(
      { employeeId: employee._id, date: dateKey, shiftId: shift.id },
      { ...fields, source: 'self' },
      userId,
    );
    log.info({ action: `punch-${kind}`, employeeId: employee._id, status: fields.status });
    return doc;
  }

  /**
   * Enter ONE check-in / check-out for a day and auto-distribute it across the
   * day's configured ca. Each ca that counts (see matchShifts) gets its own
   * session record; ca that don't count are cleared. Công for the day = sum of
   * counted ca weights.
   */
  async upsertDay(input: UpsertDayDto, userId: string) {
    const employee = await this.employees.findById(input.employeeId);
    if (!employee) throw new HttpError(404, 'Không tìm thấy nhân viên', 'EMP_001');

    const policy = await this.policy.loadPolicy();
    const dateKey = vnDateKey(input.date, policy.timezone);
    await this.assertUnlocked(dateKey);

    const onLeave = await this.attendance.findFullDayLeave(employee._id, dateKey);
    if (onLeave) throw new HttpError(409, 'Ngày này đã có đơn nghỉ phép đã duyệt', 'ATT_007');

    // Only ca that run on this weekday (ISO 1..7; getUTCDay 0=Sun → 7) AND whose
    // seasonal window (effectiveFrom/effectiveTo) covers this date — companies
    // with different summer/winter hours configure separate ca per season.
    const iso = dateKey.getUTCDay() === 0 ? 7 : dateKey.getUTCDay();
    const t = dateKey.getTime();
    const defs = (await this.shifts.listActiveShiftDefs()).filter(
      (s) =>
        s.workingDays.includes(iso) &&
        (!s.effectiveFrom || t >= s.effectiveFrom.getTime()) &&
        (!s.effectiveTo || t <= s.effectiveTo.getTime()),
    );
    if (defs.length === 0) throw new HttpError(400, 'Chưa cấu hình ca làm cho ngày này', 'ATT_005');

    const shiftDefs: ShiftDef[] = defs.map((d) => ({
      id: d.id, type: d.type, startTime: d.startTime, endTime: d.endTime,
      breakMinutes: d.breakMinutes, weight: d.weight,
    }));
    const result = matchShifts(shiftDefs, input.checkIn, input.checkOut, policy);

    const records = [];
    for (const m of result.shifts) {
      if (m.counted) {
        const doc = await this.attendance.upsertPunch(
          { employeeId: employee._id, date: dateKey, shiftId: m.shiftId },
          {
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            status: m.status,
            workHours: m.workHours,
            lateMinutes: m.lateMinutes,
            earlyMinutes: m.earlyMinutes,
            session: m.session,
            source: 'manual',
          },
          userId,
        );
        records.push(doc);
      } else {
        // Ca not worked (no overlap / left too early) — clear any stale manual
        // record so it stops counting công. Never touch leave-generated rows.
        const existing = await this.attendance.findBySlot(employee._id, dateKey, m.shiftId);
        if (existing && existing.source !== 'leave') {
          await this.attendance.deleteById(existing._id);
        }
      }
    }

    await this.audit.record({
      userId, resource: 'attendance', action: 'update',
      resourceId: employee._id,
      changes: { date: dateKey.toISOString(), totalCong: result.totalCong },
    });
    log.info({ action: 'upsert-day', employeeId: employee._id, totalCong: result.totalCong });
    return { employeeId: employee._id, date: dateKey, totalCong: result.totalCong, records };
  }

  /** Admin/HR grid: roster + active shifts + records + pooled leave/tenure. */
  async adminGrid(query: { month: string; departmentId?: string; q?: string }) {
    const [roster, shifts] = await Promise.all([
      this.attendance.roster({ departmentId: query.departmentId, q: query.q }),
      this.shifts.listActiveShifts(),
    ]);
    const { start, end } = vnMonthRange(query.month);
    const ids = roster.map((r) => r._id);
    const year = Number(query.month.split('-')[0]);
    const records = await this.attendance.findForRoster(ids, start, end);

    const now = this.clock.now().getTime();
    const employees = await Promise.all(
      roster.map(async (r) => {
        await this.entitlement.ensureEntitlement(r._id, year);
        const annualLeaveRemaining = await this.entitlement.remaining(r._id, year);
        return { ...r, annualLeaveRemaining, tenureMonths: monthsSince(r.hireDate, now) };
      }),
    );
    return { month: query.month, employees, shifts, records };
  }

  /** Create or update the record for {employee, date, shift}. */
  async upsert(input: UpsertAttendanceDto, userId: string) {
    const employee = await this.employees.findById(input.employeeId);
    if (!employee) throw new HttpError(404, 'Không tìm thấy nhân viên', 'EMP_001');

    const policy = await this.policy.loadPolicy();
    const window = await this.shifts.findShiftWindow(input.shiftId);
    if (!window) throw new HttpError(404, 'Không tìm thấy ca làm', 'ATT_005');
    const dateKey = vnDateKey(input.date, policy.timezone);
    await this.assertUnlocked(dateKey);
    const fields = computeFields(window, policy, input);

    const existing = await this.attendance.findBySlot(employee._id, dateKey, input.shiftId);
    if (existing) {
      const updated = await this.attendance.updateById(existing._id, {
        checkIn: fields.checkIn,
        checkOut: fields.checkOut,
        status: fields.status,
        workHours: fields.workHours,
        lateMinutes: fields.lateMinutes,
        earlyMinutes: fields.earlyMinutes,
        session: fields.session,
        note: input.note ?? existing.note,
        adjustedBy: userId,
        adjustedAt: this.clock.now(),
      });
      await this.audit.record({
        userId, resource: 'attendance', action: 'update',
        resourceId: existing._id, changes: { status: fields.status },
      });
      return updated;
    }

    const created = await this.attendance.createManual({
      employeeId: employee._id,
      date: dateKey,
      shiftId: input.shiftId,
      checkIn: fields.checkIn,
      checkOut: fields.checkOut,
      status: fields.status,
      workHours: fields.workHours,
      lateMinutes: fields.lateMinutes,
      earlyMinutes: fields.earlyMinutes,
      session: fields.session,
      note: input.note ?? null,
      source: 'manual',
      createdBy: userId,
    });
    await this.audit.record({
      userId, resource: 'attendance', action: 'create',
      resourceId: created._id, changes: { status: fields.status },
    });
    return created;
  }

  async bulkUpsert(rows: UpsertAttendanceDto[], userId: string) {
    let count = 0;
    for (const row of rows) {
      await this.upsert(row, userId);
      count += 1;
    }
    return { count };
  }

  /** Edit an existing record by id (HR correction, audited with reason). */
  async adjust(id: string, input: AdjustAttendanceDto, userId: string) {
    const record = await this.attendance.findById(id);
    if (!record) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');
    await this.assertUnlocked(record.date);

    const policy = await this.policy.loadPolicy();
    const shiftId = input.shiftId ?? (record.shiftId ? String(record.shiftId) : undefined);
    if (!shiftId) throw new HttpError(400, 'Thiếu ca làm', 'ATT_005');
    const window = await this.shifts.findShiftWindow(shiftId);
    if (!window) throw new HttpError(404, 'Không tìm thấy ca làm', 'ATT_005');

    const checkIn = input.checkIn !== undefined ? input.checkIn : record.checkIn;
    const checkOut = input.checkOut !== undefined ? input.checkOut : record.checkOut;
    const fields = computeFields(window, policy, { status: input.status, checkIn, checkOut });

    // NOTE: session is intentionally NOT changed on adjust (matches legacy behavior).
    const updated = await this.attendance.updateById(id, {
      shiftId,
      checkIn: fields.checkIn,
      checkOut: fields.checkOut,
      status: fields.status,
      workHours: fields.workHours,
      lateMinutes: fields.lateMinutes,
      earlyMinutes: fields.earlyMinutes,
      note: input.note !== undefined ? input.note : record.note,
      adjustedBy: userId,
      adjustedAt: this.clock.now(),
    });
    await this.audit.record({
      userId, resource: 'attendance', action: 'update',
      resourceId: id, changes: { status: fields.status, reason: input.reason ?? null },
    });
    return updated;
  }

  /** Delete one record (HR clears a ca). */
  async remove(id: string, userId: string) {
    const record = await this.attendance.findById(id);
    if (!record) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');
    await this.assertUnlocked(record.date);
    const deleted = await this.attendance.deleteById(id);
    if (!deleted) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');
    await this.audit.record({ userId, resource: 'attendance', action: 'delete', resourceId: id });
    return { id, deleted: true };
  }
}
