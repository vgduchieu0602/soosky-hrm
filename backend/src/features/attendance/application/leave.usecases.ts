import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import type { LeaveType } from '@shared/models/leave-request.model';
import { vnDateKey } from '@features/attendance/domain/attendance-calc';
import { buildHolidayChecker, countWorkingDays, leaveDays, isObjectId } from '@features/attendance/domain/leave-policy';
import type {
  LeaveRequestRepository,
  LeaveBalanceRepository,
  AttendanceRepository,
  HolidayRepository,
  EmployeeGateway,
  AuditPort,
  EventsPort,
  UnitOfWork,
  LeaveRequestRecord,
  Clock,
  Tx,
} from '@features/attendance/domain/ports';
import type { LeaveEntitlementService } from '@features/attendance/application/leave-entitlement.service';
import type { SubmitLeaveDto, UpsertLeaveBalanceDto } from '@features/attendance/dto/leave.dto';

const log = logger.child({ feature: 'attendance', module: 'leave' });

export class LeaveUseCases {
  constructor(
    private readonly leaveReq: LeaveRequestRepository,
    private readonly balances: LeaveBalanceRepository,
    private readonly attendance: AttendanceRepository,
    private readonly holidays: HolidayRepository,
    private readonly employees: EmployeeGateway,
    private readonly audit: AuditPort,
    private readonly events: EventsPort,
    private readonly uow: UnitOfWork,
    private readonly entitlement: LeaveEntitlementService,
    private readonly clock: Clock,
  ) {}

  private async employeeOfUser(userId: string): Promise<string> {
    const emp = await this.employees.findByUserId(userId);
    if (!emp) throw new HttpError(404, 'Không tìm thấy hồ sơ nhân viên', 'EMP_001');
    return emp._id;
  }

  private async holidayChecker(start: Date, end: Date): Promise<(d: Date) => boolean> {
    const rows = await this.holidays.findOverlapping(vnDateKey(start), vnDateKey(end));
    return buildHolidayChecker(rows);
  }

  /** Write attendance rows for an approved leave (idempotent by leaveRequestId). */
  private async syncLeaveAttendance(req: LeaveRequestRecord, tx: Tx): Promise<void> {
    const status = req.leaveType === 'unpaid' ? 'leave_unpaid' : 'leave_paid';
    const attSession = req.halfDaySession ?? 'full_day';
    const isHoliday = await this.holidayChecker(req.startDate, req.endDate);
    const days = leaveDays(req.startDate, req.endDate, req.halfDaySession, isHoliday);
    for (const day of days) {
      // Full-day leave supersedes any punch/manual record for that day so payroll
      // never counts the day twice; half-day leaves the other session's row alone.
      if (!req.halfDaySession) await this.attendance.supersedeDay(req.employeeId, day, req._id, tx);
      await this.attendance.upsertLeaveRow(
        req.employeeId, day, req._id,
        { session: attSession, status, source: 'leave', createdBy: req.createdBy },
        tx,
      );
    }
  }

  async submit(userId: string, dto: SubmitLeaveDto) {
    const employeeId = await this.employeeOfUser(userId);
    if (vnDateKey(dto.endDate).getTime() < vnDateKey(dto.startDate).getTime()) {
      throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu', 'LV_003');
    }
    if (dto.halfDaySession && vnDateKey(dto.startDate).getTime() !== vnDateKey(dto.endDate).getTime()) {
      throw new HttpError(400, 'Nghỉ nửa ngày chỉ áp dụng cho đơn trong cùng một ngày', 'LV_006');
    }
    const isHoliday = await this.holidayChecker(dto.startDate, dto.endDate);
    const days = countWorkingDays(dto.startDate, dto.endDate, dto.halfDaySession, isHoliday);
    if (days <= 0) throw new HttpError(400, 'Khoảng nghỉ không có ngày làm việc nào', 'LV_003');

    await this.entitlement.assertAvailable(employeeId, dto.leaveType, dto.startDate, days);
    const doc = await this.leaveReq.create({
      employeeId,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      days,
      halfDaySession: dto.halfDaySession ?? null,
      reason: dto.reason ?? null,
      createdBy: userId,
    });
    log.info({ id: doc._id, employeeId }, 'leave request submitted');
    this.events.leaveSubmitted({ leaveRequestId: doc._id, employeeId });
    return doc;
  }

  mine(userId: string) {
    return this.employeeOfUser(userId).then((id) => this.leaveReq.findByEmployee(id));
  }

  async cancelOwn(userId: string, id: string) {
    const employeeId = await this.employeeOfUser(userId);
    const req = await this.leaveReq.findById(id);
    if (!req || req.employeeId !== employeeId) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
    if (req.status !== 'pending') throw new HttpError(409, 'Chỉ huỷ được đơn đang chờ duyệt', 'LV_002');
    return this.leaveReq.updateStatus(id, { status: 'cancelled' });
  }

  adminList(filter: { status?: string }) {
    return this.leaveReq.listWithEmployee(filter);
  }

  /** Approve atomically: set status + increment the year's leave balance + sync attendance. */
  async approve(id: string, approverUserId: string) {
    const { result, employeeId } = await this.uow.withTransaction(async (tx) => {
      const req = await this.leaveReq.findById(id, tx);
      if (!req) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
      if (req.status !== 'pending') throw new HttpError(409, 'Đơn đã được xử lý', 'LV_002');

      await this.entitlement.assertAvailable(req.employeeId, req.leaveType, req.startDate, req.days, tx);

      const updated = await this.leaveReq.updateStatus(
        id,
        { status: 'approved', approverId: approverUserId, approvedAt: this.clock.now() },
        tx,
      );

      const year = vnDateKey(req.startDate).getUTCFullYear();
      await this.balances.incrementUsed(req.employeeId, req.leaveType, year, req.days, tx);
      await this.syncLeaveAttendance(updated!, tx);

      await this.audit.record({
        userId: approverUserId, resource: 'leaveRequest', action: 'update',
        resourceId: id, changes: { approved: true, days: req.days },
      });
      return { result: updated, employeeId: req.employeeId };
    });
    log.info({ id }, 'leave approved');
    this.events.leaveDecided({ leaveRequestId: id, employeeId, approved: true });
    return result;
  }

  async reject(id: string, approverUserId: string, reason: string) {
    const req = await this.leaveReq.findById(id);
    if (!req) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
    if (req.status !== 'pending') throw new HttpError(409, 'Đơn đã được xử lý', 'LV_002');
    const updated = await this.leaveReq.updateStatus(id, {
      status: 'rejected', rejectionReason: reason, approverId: approverUserId, approvedAt: this.clock.now(),
    });
    // Defensive: a pending request has no attendance yet, but stay consistent.
    await this.attendance.deleteByLeaveRequest(id);
    await this.audit.record({
      userId: approverUserId, resource: 'leaveRequest', action: 'update',
      resourceId: id, changes: { rejected: true, reason },
    });
    log.info({ id }, 'leave rejected');
    this.events.leaveDecided({ leaveRequestId: id, employeeId: req.employeeId, approved: false, reason });
    return updated;
  }

  /** Revoke an APPROVED leave: restore used balance, clear attendance, mark cancelled. */
  async revoke(id: string, approverUserId: string, reason?: string) {
    const { result, employeeId } = await this.uow.withTransaction(async (tx) => {
      const req = await this.leaveReq.findById(id, tx);
      if (!req) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
      if (req.status !== 'approved') throw new HttpError(409, 'Chỉ thu hồi được đơn đã duyệt', 'LV_002');

      const updated = await this.leaveReq.updateStatus(
        id,
        { status: 'cancelled', rejectionReason: reason ?? 'Thu hồi bởi HR' },
        tx,
      );

      const year = vnDateKey(req.startDate).getUTCFullYear();
      const bal = await this.balances.findOne(req.employeeId, req.leaveType, year, tx);
      if (bal) await this.balances.setUsed(bal._id, Math.max(0, bal.used - req.days), tx);
      await this.attendance.deleteByLeaveRequest(id, tx);

      await this.audit.record({
        userId: approverUserId, resource: 'leaveRequest', action: 'update',
        resourceId: id, changes: { revoked: true, restoredDays: req.days, reason: reason ?? null },
      });
      return { result: updated, employeeId: req.employeeId };
    });
    log.info({ id }, 'leave revoked');
    this.events.leaveDecided({
      leaveRequestId: id, employeeId, approved: false, reason: reason ?? 'Đơn nghỉ đã được thu hồi',
    });
    return result;
  }

  async myBalances(userId: string) {
    const employeeId = await this.employeeOfUser(userId);
    const year = this.clock.now().getUTCFullYear();
    return this.balances.findByEmployeeYear(employeeId, year);
  }

  async adminBalances(employeeId: string, year?: number) {
    if (!isObjectId(employeeId)) throw new HttpError(400, 'employeeId không hợp lệ', 'EMP_001');
    const y = year ?? this.clock.now().getUTCFullYear();
    return this.balances.findByEmployeeYear(employeeId, y);
  }

  /** HR sets/updates a leave quota (entitled days). `used` is preserved. */
  async upsertBalance(input: UpsertLeaveBalanceDto, auditUserId: string) {
    const updated = await this.balances.upsertEntitled(
      input.employeeId, input.leaveType as LeaveType, input.year, input.entitled,
    );
    await this.audit.record({
      userId: auditUserId, resource: 'leaveBalance', action: 'update',
      resourceId: updated._id, changes: input as Record<string, unknown>,
    });
    return updated;
  }
}
