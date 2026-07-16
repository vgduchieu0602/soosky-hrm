/// <reference types="jest" />
/**
 * TIER 1 — HTTP: day-level attendance entry (POST /admin/attendances/day).
 * One check-in/out is distributed across the day's configured ca; each ca that
 * counts becomes its own session record. Verifies the fan-out + công total and
 * that leaving early beyond tolerance voids a ca.
 */
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@shared/testing/http';
import { Employee } from '@shared/models/employee.model';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import { Shift } from '@shared/models/shift.model';
import { CompanyConfig } from '@shared/models/company-config.model';
import { Attendance } from '@shared/models/attendance.model';

jest.setTimeout(60_000);

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

async function seedEmployee(): Promise<string> {
  const dept = await Department.create({ name: 'Eng', code: `D${Date.now()}` });
  const pos = await Position.create({ title: 'Eng', code: `P${Date.now()}`, departmentId: dept._id, level: 1 });
  const emp = await Employee.create({
    employeeCode: `E${Date.now()}`,
    departmentId: dept._id,
    positionId: pos._id,
    hireDate: new Date('2026-01-01'),
    employeeType: 'full_time',
    status: 'active',
  });
  return emp._id.toString();
}

async function seedTwoShifts() {
  // A Monday-inclusive workingDays set so 2026-06-15 (Mon) matches.
  await Shift.create({ name: 'Sáng', type: 'morning', startTime: '09:00', endTime: '12:00', breakMinutes: 0, weight: 0.5, workingDays: [1, 2, 3, 4, 5], status: 'active' });
  await Shift.create({ name: 'Chiều', type: 'afternoon', startTime: '13:30', endTime: '17:30', breakMinutes: 0, weight: 0.5, workingDays: [1, 2, 3, 4, 5], status: 'active' });
}

const DATE = '2026-06-15'; // Monday
const vn = (hhmm: string) => `${DATE}T${hhmm}:00+07:00`;

describe('POST /admin/attendances/day — auto-match multiple shifts', () => {
  it('vào 8:50 ra 16:30 → 2 bản ghi session, tổng 1 công', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    await seedTwoShifts();
    await CompanyConfig.create({ key: 'global', earlyLeaveToleranceMinutes: 90 });

    const res = await api
      .post('/api/v1/admin/attendances/day')
      .set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('16:30') });

    expect(res.status).toBe(201);
    expect(res.body.data.totalCong).toBe(1);

    const rows = await Attendance.find({ employeeId }).lean();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.session).sort()).toEqual(['afternoon', 'morning']);
  });

  it('về sớm quá dung sai (ra 15:00) → chỉ ca sáng, 0.5 công, ca chiều không có bản ghi', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    await seedTwoShifts();
    await CompanyConfig.create({ key: 'global', earlyLeaveToleranceMinutes: 60 });

    const res = await api
      .post('/api/v1/admin/attendances/day')
      .set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('15:00') });

    expect(res.status).toBe(201);
    expect(res.body.data.totalCong).toBe(0.5);

    const rows = await Attendance.find({ employeeId }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.session).toBe('morning');
  });

  it('re-nhập ra sớm hơn → ca chiều bị xoá (không còn tính công)', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    await seedTwoShifts();
    await CompanyConfig.create({ key: 'global', earlyLeaveToleranceMinutes: 90 });

    await api.post('/api/v1/admin/attendances/day').set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('16:30') });
    expect(await Attendance.countDocuments({ employeeId })).toBe(2);

    // Correct the checkout to 14:00 → afternoon (early 210 > 90) voided & cleared.
    const res = await api.post('/api/v1/admin/attendances/day').set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('14:00') });
    expect(res.body.data.totalCong).toBe(0.5);
    expect(await Attendance.countDocuments({ employeeId })).toBe(1);
  });

  it('chấm vào cuối tuần (ca chỉ áp dụng T2–T6) → 400 với thông báo nêu rõ thứ', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    await seedTwoShifts(); // workingDays [1..5]
    await CompanyConfig.create({ key: 'global' });

    const SUN = '2026-06-14'; // Sunday
    const res = await api.post('/api/v1/admin/attendances/day').set(bearer(token))
      .send({ employeeId, date: SUN, checkIn: `${SUN}T13:38:00+07:00`, checkOut: `${SUN}T18:00:00+07:00` });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('ATT_005');
    expect(res.body.error?.message).toContain('CN'); // weekday label surfaced
  });

  it('chưa cấu hình ca nào → 400 với thông báo hướng dẫn vào Cài đặt', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    await CompanyConfig.create({ key: 'global' });

    const res = await api.post('/api/v1/admin/attendances/day').set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('16:30') });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('ATT_005');
    expect(res.body.error?.message).toContain('Cài đặt');
  });

  it('chấm ĐÚNG ngày effectiveTo (biên) → ca vẫn áp dụng', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    // Afternoon ca whose season ends exactly on DATE — punch that day must still count.
    await Shift.create({ name: 'Sáng', type: 'morning', startTime: '09:00', endTime: '12:00', breakMinutes: 0, weight: 0.5, workingDays: [1, 2, 3, 4, 5], status: 'active' });
    await Shift.create({
      name: 'Chiều', type: 'afternoon', startTime: '13:30', endTime: '17:30', breakMinutes: 0, weight: 0.5,
      workingDays: [1, 2, 3, 4, 5], status: 'active',
      effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date(`${DATE}T00:00:00.000Z`),
    });
    await CompanyConfig.create({ key: 'global', earlyLeaveToleranceMinutes: 90 });

    const res = await api.post('/api/v1/admin/attendances/day').set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('16:30') });

    expect(res.status).toBe(201);
    expect(res.body.data.totalCong).toBe(1); // both ca counted on the boundary day
  });

  it('ca chiều ngoài mùa áp dụng → chỉ còn 1 ca áp dụng → ca sáng = 1 công (cả ngày)', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    await Shift.create({ name: 'Sáng', type: 'morning', startTime: '09:00', endTime: '12:00', breakMinutes: 0, weight: 0.5, workingDays: [1, 2, 3, 4, 5], status: 'active' });
    // Winter-only afternoon ca — its season ended before DATE (2026-06-15).
    await Shift.create({
      name: 'Chiều (mùa đông)', type: 'afternoon', startTime: '13:30', endTime: '17:30', breakMinutes: 0, weight: 0.5,
      workingDays: [1, 2, 3, 4, 5], status: 'active',
      effectiveFrom: new Date('2025-11-01'), effectiveTo: new Date('2026-03-31'),
    });
    await CompanyConfig.create({ key: 'global', earlyLeaveToleranceMinutes: 90 });

    const res = await api.post('/api/v1/admin/attendances/day').set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('16:30') });

    expect(res.status).toBe(201);
    // Only the morning ca applies this day (afternoon out of season) → công is
    // split across 1 ca → 1.0 (that ca IS the whole working day).
    expect(res.body.data.totalCong).toBe(1);
    const rows = await Attendance.find({ employeeId }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.session).toBe('morning');
    expect(rows[0]!.congWeight).toBe(1);
  });

  it('công mỗi ca = 1/số ca: đủ 2 ca → mỗi ca 0.5, tổng 1', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    await seedTwoShifts();
    await CompanyConfig.create({ key: 'global', earlyLeaveToleranceMinutes: 90 });

    await api.post('/api/v1/admin/attendances/day').set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('16:30') });

    const rows = await Attendance.find({ employeeId }).sort({ session: 1 }).lean();
    expect(rows.map((r) => r.congWeight)).toEqual([0.5, 0.5]);
  });

  it('ca đặt nhầm loại "full_day" vẫn = 0.5 khi có 2 ca (không phụ thuộc loại ca)', async () => {
    const { token } = tokenFor(['hr_manager']);
    const employeeId = await seedEmployee();
    // Both ca mistakenly typed full_day (weight 1) — công must still be 1/2 each.
    await Shift.create({ name: 'Sáng', type: 'full_day', startTime: '09:00', endTime: '12:00', breakMinutes: 0, weight: 1, workingDays: [1, 2, 3, 4, 5], status: 'active' });
    await Shift.create({ name: 'Chiều', type: 'full_day', startTime: '13:30', endTime: '17:30', breakMinutes: 0, weight: 1, workingDays: [1, 2, 3, 4, 5], status: 'active' });
    await CompanyConfig.create({ key: 'global', earlyLeaveToleranceMinutes: 90 });

    const res = await api.post('/api/v1/admin/attendances/day').set(bearer(token))
      .send({ employeeId, date: DATE, checkIn: vn('08:50'), checkOut: vn('16:30') });

    expect(res.body.data.totalCong).toBe(1); // 0.5 + 0.5, not 2
    const rows = await Attendance.find({ employeeId }).lean();
    expect(rows.every((r) => r.congWeight === 0.5)).toBe(true);
  });
});
