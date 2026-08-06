import AttendancePeriodLockedError from "@modules/attendance/core/app/errors/AttendancePeriodLockedError";
import NoApplicableShiftError from "@modules/attendance/core/app/errors/NoApplicableShiftError";
import AttendancePeriodLockDirectory from "@modules/attendance/core/app/ports/AttendancePeriodLockDirectory";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import CompanyCalendarDirectory from "@modules/attendance/core/app/ports/CompanyCalendarDirectory";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";
import { DEFAULT_POLICY, matchShifts, vnDateKey } from "@modules/attendance/core/domain/services/attendance-calc";
import { buildHolidayChecker } from "@modules/attendance/core/domain/services/leave-calc";
import AttendanceSession from "@modules/attendance/core/domain/value-objects/AttendanceSession";
import AttendanceStatus from "@modules/attendance/core/domain/value-objects/AttendanceStatus";
import createUuidV7 from "@shared/core/domain/UuidV7";

export interface WriteAttendanceDayInput {
    employeeId: string;
    /** Thời điểm bất kỳ trong ngày cần ghi; được chuẩn hoá về date-key theo timezone công ty. */
    date:       Date;
    checkIn?: Date | null | undefined;
    checkOut?: Date | null | undefined;
    note?: string | null | undefined;
    /** Nguồn dữ liệu: `manual` (HR nhập) hoặc `correction` (yêu cầu chỉnh công được duyệt). */
    source:     string;
}

export interface WriteAttendanceDayOutput {
    date:      Date;
    totalCong: number;
    records:   Attendance[];
}

/**
 * Ghi (hoặc ghi lại) bảng công của MỘT nhân viên trong MỘT ngày — nơi duy nhất
 * trong hệ thống biết cách biến một cặp giờ vào/ra thành các bản ghi chấm công.
 *
 * Dùng chung bởi HR nhập tay (`UpsertAttendanceUseCase`) và yêu cầu chỉnh công
 * được duyệt (`ApproveAttendanceCorrectionUseCase`). Nếu để mỗi luồng tự tính,
 * chỉnh công được duyệt sẽ cho ra số công khác với HR nhập cùng dữ liệu — sai
 * lệch rất khó phát hiện.
 *
 * Ba lớp bảo vệ, theo đúng thứ tự:
 *  1. KỲ ĐÃ CHỐT → chặn. Dữ liệu đầu vào của lương đã đông cứng thì không ai
 *     được sửa lén; muốn sửa phải mở khoá qua luồng có quyền.
 *  2. NGÀY LỄ → ghi một bản ghi `holiday` trung tính, không đòi phải có ca.
 *  3. Không có ca nào áp dụng cho thứ trong tuần đó → lỗi (ngày không làm việc).
 *
 * Timezone lấy từ cấu hình công ty, KHÔNG lấy giờ máy chủ: container chạy UTC
 * nên 08:00 giờ Việt Nam sẽ thành 01:00 và mọi phép tính trễ/sớm lệch 7 tiếng.
 */
export default class AttendanceDayWriter {
    public constructor(
        private readonly _attendanceRepo: AttendanceRepo,
        private readonly _shiftRepo: ShiftRepo,
        private readonly _holidayRepo: HolidayRepo,
        private readonly _companyCalendar: CompanyCalendarDirectory,
        private readonly _periodLocks: AttendancePeriodLockDirectory,
    ) {}

    /**
     * @throws {AttendancePeriodLockedError} Ngày này thuộc kỳ đã chốt chấm công.
     * @throws {NoApplicableShiftError}      Không có ca nào áp dụng cho ngày này.
     */
    public async write(input: WriteAttendanceDayInput): Promise<WriteAttendanceDayOutput> {
        const timezone = await this._companyCalendar.timezone();
        const dateKey  = vnDateKey(input.date, timezone);

        const locked = await this._periodLocks.findLockedPeriodCovering(dateKey);
        if (locked != undefined) throw new AttendancePeriodLockedError(locked.name);

        if (await this._isHoliday(dateKey)) {
            return this._writeHoliday(input.employeeId, dateKey, input.note, input.source);
        }

        const isoWeekday   = dateKey.getUTCDay() === 0 ? 7 : dateKey.getUTCDay();
        const activeShifts = await this._shiftRepo.listActive();
        const applicable   = activeShifts.filter(shift => shift.appliesToWeekday(isoWeekday));
        if (applicable.length === 0) throw new NoApplicableShiftError();

        const result = matchShifts(
            applicable.map(shift => ({
                id:           shift.id,
                startTime:    shift.window.startTime,
                endTime:      shift.window.endTime,
                breakMinutes: shift.window.breakMinutes,
            })),
            input.checkIn,
            input.checkOut,
            { ...DEFAULT_POLICY, timezone },
        );

        const records: Attendance[] = [];
        for (const matched of result.shifts) {
            const existing = await this._attendanceRepo.getBySlot(input.employeeId, dateKey, matched.shiftId);

            // Ca không được tính công: giữ lại bản ghi để nêu rõ TẠI SAO (vắng /
            // dở dang / về sớm) thay vì im lặng không có gì. Riêng bản ghi do
            // nghỉ phép sinh ra thì không đụng — nó thuộc luồng nghỉ phép.
            if (!matched.counted && existing != undefined && existing.source === "leave") continue;

            const attendance = existing ?? Attendance.create({
                id:             createUuidV7(),
                employeeId:     input.employeeId,
                date:           dateKey,
                shiftId:        matched.shiftId,
                checkIn:        null,
                checkOut:       null,
                status:         AttendanceStatus.ABSENT,
                workHours:      null,
                lateMinutes:    0,
                earlyMinutes:   0,
                session:        AttendanceSession.FULL_DAY,
                congWeight:     0,
                source:         input.source,
                note:           null,
                leaveRequestId: null,
            });

            attendance.applyPunch({
                checkIn:      input.checkIn ?? null,
                checkOut:     input.checkOut ?? null,
                status:       AttendanceStatus.create(matched.status),
                workHours:    matched.workHours,
                lateMinutes:  matched.lateMinutes,
                earlyMinutes: matched.earlyMinutes,
                session:      AttendanceSession.FULL_DAY,
                congWeight:   matched.counted ? matched.congWeight : 0,
                source:       input.source,
            });
            if (input.note !== undefined) attendance.changeNote(input.note ?? null);

            await this._attendanceRepo.save(attendance);
            records.push(attendance);
        }

        return { date: dateKey, totalCong: result.totalCong, records };
    }

    private async _isHoliday(dateKey: Date): Promise<boolean> {
        const holidays  = await this._holidayRepo.listOverlapping(dateKey, dateKey);
        const isHoliday = buildHolidayChecker(holidays.map(h => ({ date: h.date, isRecurring: h.isRecurring })));
        return isHoliday(dateKey);
    }

    /**
     * Ngày lễ: một bản ghi `holiday` duy nhất, `congWeight` 0 và KHÔNG gắn ca.
     * Payroll coi `holiday` là trung tính (không vào tử số lẫn mẫu số của tỉ lệ
     * chuyên cần), nên nghỉ lễ không làm giảm lương mà cũng không được tính là
     * ngày đi làm.
     */
    private async _writeHoliday(
        employeeId: string,
        dateKey:    Date,
        note:       string | null | undefined,
        source:     string,
    ): Promise<WriteAttendanceDayOutput> {
        const HOLIDAY_SLOT = "";   // không thuộc ca nào

        const existing = await this._attendanceRepo.getBySlot(employeeId, dateKey, HOLIDAY_SLOT);

        // Nghỉ phép đã ghi ở ngày này thì tôn trọng bản ghi đó — nghỉ phép trùng
        // ngày lễ là chuyện của luồng nghỉ phép, không phải của chấm công.
        if (existing != undefined && existing.source === "leave") {
            return { date: dateKey, totalCong: 0, records: [existing] };
        }

        const attendance = existing ?? Attendance.create({
            id:             createUuidV7(),
            employeeId,
            date:           dateKey,
            shiftId:        HOLIDAY_SLOT,
            checkIn:        null,
            checkOut:       null,
            status:         AttendanceStatus.HOLIDAY,
            workHours:      0,
            lateMinutes:    0,
            earlyMinutes:   0,
            session:        AttendanceSession.FULL_DAY,
            congWeight:     0,
            source,
            note:           null,
            leaveRequestId: null,
        });

        attendance.applyPunch({
            checkIn:      null,
            checkOut:     null,
            status:       AttendanceStatus.HOLIDAY,
            workHours:    0,
            lateMinutes:  0,
            earlyMinutes: 0,
            session:      AttendanceSession.FULL_DAY,
            congWeight:   0,
            source,
        });
        if (note !== undefined) attendance.changeNote(note ?? null);

        await this._attendanceRepo.save(attendance);

        return { date: dateKey, totalCong: 0, records: [attendance] };
    }
}
