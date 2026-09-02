import { computeAttendance, deriveWorkedSession, minutesOfDayVN, type ShiftWindow } from '@modules/hrm/core/attendance/domain/attendance-calc';

const FULL: ShiftWindow = { startTime: '08:00', endTime: '17:00', breakMinutes: 60 };
const AFTERNOON: ShiftWindow = { startTime: '13:00', endTime: '17:00', breakMinutes: 0 };

// Build a UTC instant from a VN wall-clock time (VN = UTC+7).
const vn = (hhmm: string, day = '2026-06-15') => new Date(`${day}T${hhmm}:00+07:00`);

describe('attendance-calc — Phụ lục E2', () => {
  it('#1 đúng giờ chuẩn → present 8.00', () => {
    expect(computeAttendance({ shift: FULL, checkIn: vn('07:55'), checkOut: vn('17:05') })).toEqual({
      status: 'present',
      workHours: 8.0,
      lateMinutes: 0,
      earlyMinutes: 0,
      session: 'full_day',
    });
  });

  it('#2 trong dung sai (08:05) → present 7.92', () => {
    const r = computeAttendance({ shift: FULL, checkIn: vn('08:05'), checkOut: vn('17:00') });
    expect(r.status).toBe('present');
    expect(r.workHours).toBe(7.92);
  });

  it('#3 đi muộn → late 7.67', () => {
    const r = computeAttendance({ shift: FULL, checkIn: vn('08:20'), checkOut: vn('17:00') });
    expect(r.status).toBe('late');
    expect(r.workHours).toBe(7.67);
    expect(r.lateMinutes).toBe(20);
  });

  it('#4 về sớm → early_leave 7.00', () => {
    const r = computeAttendance({ shift: FULL, checkIn: vn('08:00'), checkOut: vn('16:00') });
    expect(r.status).toBe('early_leave');
    expect(r.workHours).toBe(7.0);
    expect(r.earlyMinutes).toBe(60);
  });

  it('#5 muộn + về sớm → late (earlyMinutes>0) 7.00', () => {
    const r = computeAttendance({ shift: FULL, checkIn: vn('08:30'), checkOut: vn('16:30') });
    expect(r.status).toBe('late');
    expect(r.workHours).toBe(7.0);
    expect(r.lateMinutes).toBe(30);
    expect(r.earlyMinutes).toBe(30);
  });

  it('#6 thiếu check-out → incomplete, workHours null', () => {
    const r = computeAttendance({ shift: FULL, checkIn: vn('08:00'), checkOut: null });
    expect(r.status).toBe('incomplete');
    expect(r.workHours).toBeNull();
  });

  it('#7 không check-in → absent 0', () => {
    const r = computeAttendance({ shift: FULL, checkIn: null, checkOut: null });
    expect(r.status).toBe('absent');
    expect(r.workHours).toBe(0);
  });

  it('#11 BẪY MÚI GIỜ: input lưu UTC 01:15Z = 08:15 VN → late 7.75', () => {
    const checkIn = new Date('2026-06-15T01:15:00Z'); // = 08:15 giờ VN
    expect(minutesOfDayVN(checkIn)).toBe(8 * 60 + 15);
    const r = computeAttendance({ shift: FULL, checkIn, checkOut: vn('17:00') });
    expect(r.status).toBe('late');
    expect(r.workHours).toBe(7.75);
  });

  it('#12 quá giờ (không OT) → present 8.00 (kẹp tại 17:00)', () => {
    const r = computeAttendance({ shift: FULL, checkIn: vn('08:00'), checkOut: vn('19:00') });
    expect(r.status).toBe('present');
    expect(r.workHours).toBe(8.0);
  });

  it('#13 ca chiều → present 4.00', () => {
    const r = computeAttendance({ shift: AFTERNOON, checkIn: vn('13:00'), checkOut: vn('17:00') });
    expect(r.status).toBe('present');
    expect(r.workHours).toBe(4.0);
  });

  it('#14 vào sớm trước ca → present 8.00 (kẹp tại 08:00)', () => {
    const r = computeAttendance({ shift: FULL, checkIn: vn('07:30'), checkOut: vn('17:00') });
    expect(r.status).toBe('present');
    expect(r.workHours).toBe(8.0);
  });
});

describe('deriveWorkedSession — 1 công vs nửa công theo giờ vào/ra', () => {
  it('phủ cả sáng + chiều → full_day (1 công)', () => {
    expect(deriveWorkedSession(FULL, vn('08:00'), vn('17:00'))).toBe('full_day');
  });
  it('chỉ buổi sáng → morning (0.5 công)', () => {
    expect(deriveWorkedSession(FULL, vn('08:00'), vn('12:00'))).toBe('morning');
  });
  it('chỉ buổi chiều → afternoon (0.5 công)', () => {
    expect(deriveWorkedSession(FULL, vn('13:00'), vn('17:00'))).toBe('afternoon');
  });
  it('thiếu giờ ra → null (không xác định công)', () => {
    expect(deriveWorkedSession(FULL, vn('08:00'), null)).toBeNull();
  });
  it('computeAttendance gắn session=morning khi chỉ chấm buổi sáng', () => {
    expect(computeAttendance({ shift: FULL, checkIn: vn('08:00'), checkOut: vn('12:00') }).session).toBe('morning');
  });
});
