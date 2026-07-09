/// <reference types="jest" />
import { matchShifts, DEFAULT_POLICY, type ShiftDef, type AttendancePolicy } from '../domain/attendance-calc';

// Two independent ca: morning 09:00–12:00 (0.5), afternoon 13:30–17:30 (0.5).
const MORNING: ShiftDef = { id: 'm', type: 'morning', startTime: '09:00', endTime: '12:00', breakMinutes: 0, weight: 0.5 };
const AFTERNOON: ShiftDef = { id: 'a', type: 'afternoon', startTime: '13:30', endTime: '17:30', breakMinutes: 0, weight: 0.5 };
const SHIFTS = [MORNING, AFTERNOON];

// Build a UTC instant from a VN wall-clock time (VN = UTC+7).
const vn = (hhmm: string) => new Date(`2026-06-15T${hhmm}:00+07:00`);

// Generous tolerance so leaving early within reason still counts (matches the
// company rule: presence in/out = full công, early doesn't deduct).
const POLICY: AttendancePolicy = { ...DEFAULT_POLICY, earlyLeaveToleranceMin: 90 };

describe('matchShifts — 1 vào/ra tự khớp nhiều ca', () => {
  it('vào 8:50 ra 16:30 → khớp cả 2 ca = 1 công', () => {
    const r = matchShifts(SHIFTS, vn('08:50'), vn('16:30'), POLICY);
    expect(r.totalCong).toBe(1);
    expect(r.shifts.filter((s) => s.counted).map((s) => s.session).sort()).toEqual(['afternoon', 'morning']);
  });

  it('về sớm trong dung sai (ra 16:30, sớm 60 ≤ 90) → ca chiều vẫn đủ công', () => {
    const r = matchShifts(SHIFTS, vn('08:50'), vn('16:30'), POLICY);
    const aft = r.shifts.find((s) => s.session === 'afternoon')!;
    expect(aft.counted).toBe(true);
    expect(aft.earlyMinutes).toBe(60);
  });

  it('về sớm quá dung sai (ra 15:30, sớm 120 > 90) → ca chiều mất công', () => {
    const r = matchShifts(SHIFTS, vn('08:50'), vn('15:30'), POLICY);
    const aft = r.shifts.find((s) => s.session === 'afternoon')!;
    expect(aft.counted).toBe(false);
    expect(r.totalCong).toBe(0.5); // chỉ còn ca sáng
  });

  it('chỉ làm buổi sáng (ra 11:30) → 0.5 công, ca chiều absent', () => {
    const r = matchShifts(SHIFTS, vn('08:50'), vn('11:30'), POLICY);
    expect(r.totalCong).toBe(0.5);
    expect(r.shifts.find((s) => s.session === 'morning')!.counted).toBe(true);
    expect(r.shifts.find((s) => s.session === 'afternoon')!.counted).toBe(false);
  });

  it('đi muộn không làm mất công (vào 9:40 muộn 40) → ca sáng vẫn đủ công', () => {
    const r = matchShifts(SHIFTS, vn('09:40'), vn('17:30'), POLICY);
    const morn = r.shifts.find((s) => s.session === 'morning')!;
    expect(morn.counted).toBe(true);
    expect(morn.lateMinutes).toBe(40);
    expect(r.totalCong).toBe(1);
  });

  it('thiếu giờ ra → không ca nào tính công', () => {
    const r = matchShifts(SHIFTS, vn('08:50'), null, POLICY);
    expect(r.totalCong).toBe(0);
    expect(r.shifts.every((s) => !s.counted)).toBe(true);
  });

  it('vắng hoàn toàn (không vào/ra) → absent, 0 công', () => {
    const r = matchShifts(SHIFTS, null, null, POLICY);
    expect(r.totalCong).toBe(0);
    expect(r.shifts.every((s) => s.status === 'absent')).toBe(true);
  });
});
