import { vi } from 'vitest';
/**
 * TIER 1 — HTTP integration cho vòng đời nhân viên + nhập/xuất CSV, chạy qua
 * đúng chuỗi middleware thật (authenticate → requireRoles → validate → controller)
 * trên MongoDB replica set trong bộ nhớ (giao dịch chạy thật).
 *
 * Điều được khoá ở đây: mỗi thay đổi vòng đời phải để lại một bản ghi lịch sử có
 * `effectiveDate` + lý do; dữ liệu cũ không bị ghi đè; và nghỉ việc không xoá
 * nhân viên.
 */
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@/test-support/http';
import { Department } from '@shared/models/department.model';
import { Position } from '@shared/models/position.model';
import { Employee } from '@shared/models/employee.model';
import { EmployeeHistory } from '@shared/models/employee-history.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';

vi.setConfig({ testTimeout: 90_000 });

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const hr = () => bearer(tokenFor(['hr_manager']).token);

let seq = 0;
const uniq = () => `${Date.now()}${(seq += 1)}`;

async function seedOrg() {
  const suffix = uniq();
  const engineering = await Department.create({ name: 'Engineering', code: `ENG${suffix}` });
  const product = await Department.create({ name: 'Product', code: `PRD${suffix}` });
  const dev = await Position.create({ title: 'Software Engineer', code: `SE${suffix}`, departmentId: engineering._id, level: 1 });
  const senior = await Position.create({ title: 'Senior Software Engineer', code: `SSE${suffix}`, departmentId: engineering._id, level: 2 });
  return {
    engineeringId: engineering._id.toString(),
    productId: product._id.toString(),
    devId: dev._id.toString(),
    seniorId: senior._id.toString(),
    engineeringCode: engineering.code,
    devCode: dev.code,
  };
}

async function createEmployee(
  org: { engineeringId: string; devId: string },
  code: string,
  extra: Record<string, unknown> = {},
) {
  const res = await api
    .post('/api/v1/admin/employees')
    .set(hr())
    .send({
      employeeCode: code,
      departmentId: org.engineeringId,
      positionId: org.devId,
      hireDate: '2026-01-01',
      employeeType: 'full_time',
      profile: { firstName: 'An', lastName: 'Nguyễn' },
      ...extra,
    });
  expect(res.status).toBe(201);
  return String(res.body.data._id);
}

async function addContract(employeeId: string, body: Record<string, unknown>) {
  const res = await api.post(`/api/v1/admin/employees/${employeeId}/contracts`).set(hr()).send({
    contractType: 'fixed_term',
    contractNumber: `HD-${uniq()}`,
    startDate: '2026-01-01',
    baseSalary: 15_000_000,
    ...body,
  });
  expect(res.status).toBe(201);
  return res.body.data;
}

describe('Điều chuyển phòng ban', () => {
  it('cập nhật trạng thái hiện tại VÀ ghi một bản ghi lịch sử có ngày hiệu lực + lý do', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `MOV${uniq()}`);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/transfer`)
      .set(hr())
      .send({
        newDepartmentId: org.productId,
        effectiveDate: '2026-06-15',
        reason: 'Tái cơ cấu sang Product',
      });

    expect(res.status).toBe(200);
    const employee = await Employee.findById(employeeId);
    expect(String(employee?.departmentId)).toBe(org.productId);

    const history = await EmployeeHistory.find({ employeeId }).sort({ created_at: 1 });
    const transfer = history.find((h) => h.eventType === 'transfer');
    expect(transfer).toBeTruthy();
    expect(transfer!.fromValue).toMatchObject({ departmentId: org.engineeringId });
    expect(transfer!.toValue).toMatchObject({ departmentId: org.productId });
    expect(transfer!.note).toBe('Tái cơ cấu sang Product');
    expect(transfer!.effectiveDate.toISOString().slice(0, 10)).toBe('2026-06-15');
    // Bản ghi "hired" lúc tạo vẫn còn nguyên — lịch sử không bị ghi đè.
    expect(history.some((h) => h.eventType === 'hired')).toBe(true);
  });

  it('chuyển sang đúng phòng ban đang ở → 422, không tạo bản ghi rác', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `SAME${uniq()}`);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/transfer`)
      .set(hr())
      .send({ newDepartmentId: org.engineeringId, effectiveDate: '2026-06-15', reason: 'Không đổi gì' });

    expect(res.status).toBe(422);
    expect(await EmployeeHistory.countDocuments({ employeeId, eventType: 'transfer' })).toBe(0);
  });

  it('thiếu lý do → bị chặn ở tầng validate', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `NOR${uniq()}`);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/transfer`)
      .set(hr())
      .send({ newDepartmentId: org.productId, effectiveDate: '2026-06-15' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('ngày hiệu lực trước ngày vào làm → 422', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `EFF${uniq()}`);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/transfer`)
      .set(hr())
      .send({ newDepartmentId: org.productId, effectiveDate: '2025-12-01', reason: 'Ghi lùi quá xa' });

    expect(res.status).toBe(422);
  });

  it('nhân viên thường không được điều chuyển ai (403)', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `PRM${uniq()}`);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/transfer`)
      .set(bearer(tokenFor(['employee']).token))
      .send({ newDepartmentId: org.productId, effectiveDate: '2026-06-15', reason: 'Thử vượt quyền' });

    expect(res.status).toBe(403);
  });
});

describe('Đổi chức vụ / thăng chức', () => {
  it('thăng chức ghi eventType `promotion` kèm chức vụ cũ → mới', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `PROMO${uniq()}`);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/change-position`)
      .set(hr())
      .send({
        newPositionId: org.seniorId,
        changeType: 'promotion',
        effectiveDate: '2026-06-01',
        reason: 'Đạt yêu cầu thăng cấp',
      });

    expect(res.status).toBe(200);
    const promotion = await EmployeeHistory.findOne({ employeeId, eventType: 'promotion' });
    expect(promotion?.fromValue).toMatchObject({ positionId: org.devId });
    expect(promotion?.toValue).toMatchObject({ positionId: org.seniorId });
  });

  it('điều chuyển ngang ghi eventType `position_change`', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `POSC${uniq()}`);

    await api
      .post(`/api/v1/admin/employees/${employeeId}/change-position`)
      .set(hr())
      .send({ newPositionId: org.seniorId, effectiveDate: '2026-06-01', reason: 'Điều chuyển ngang' })
      .expect(200);

    expect(await EmployeeHistory.countDocuments({ employeeId, eventType: 'position_change' })).toBe(1);
  });
});

describe('Đổi quản lý', () => {
  it('gán quản lý hợp lệ và ghi lịch sử', async () => {
    const org = await seedOrg();
    const managerId = await createEmployee(org, `MGR${uniq()}`);
    const employeeId = await createEmployee(org, `SUB${uniq()}`);

    await api
      .post(`/api/v1/admin/employees/${employeeId}/change-manager`)
      .set(hr())
      .send({ newManagerId: managerId, effectiveDate: '2026-06-01', reason: 'Về team mới' })
      .expect(200);

    const employee = await Employee.findById(employeeId);
    expect(String(employee?.managerId)).toBe(managerId);
    expect(await EmployeeHistory.countDocuments({ employeeId, eventType: 'manager_change' })).toBe(1);
  });

  it('tự làm quản lý của chính mình → 422', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `SELF${uniq()}`);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/change-manager`)
      .set(hr())
      .send({ newManagerId: employeeId, effectiveDate: '2026-06-01', reason: 'Vòng lặp' });

    expect(res.status).toBe(422);
  });

  it('tạo vòng lặp quản lý (A→B rồi B→A) → 422', async () => {
    const org = await seedOrg();
    const a = await createEmployee(org, `CYA${uniq()}`);
    const b = await createEmployee(org, `CYB${uniq()}`);

    // B báo cáo A.
    await api
      .post(`/api/v1/admin/employees/${b}/change-manager`)
      .set(hr())
      .send({ newManagerId: a, effectiveDate: '2026-06-01', reason: 'Bình thường' })
      .expect(200);

    // Giờ thử cho A báo cáo B → vòng lặp.
    const res = await api
      .post(`/api/v1/admin/employees/${a}/change-manager`)
      .set(hr())
      .send({ newManagerId: b, effectiveDate: '2026-06-02', reason: 'Tạo vòng lặp' });

    expect(res.status).toBe(422);
    expect(res.body.error?.message ?? res.body.message).toContain('vòng lặp');
  });

  it('quản lý đã nghỉ việc → 422', async () => {
    const org = await seedOrg();
    const gone = await createEmployee(org, `GONE${uniq()}`);
    const employeeId = await createEmployee(org, `KEEP${uniq()}`);
    await Employee.updateOne({ _id: gone }, { $set: { status: 'terminated' } });

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/change-manager`)
      .set(hr())
      .send({ newManagerId: gone, effectiveDate: '2026-06-01', reason: 'Quản lý đã nghỉ' });

    expect(res.status).toBe(422);
  });
});

describe('Thử việc', () => {
  it('hoàn tất thử việc: hợp đồng → official, nhân viên onboarding → active, có lịch sử', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `PRB${uniq()}`);
    await addContract(employeeId, { employmentStatus: 'probation', endDate: '2026-03-01' });

    await api
      .post(`/api/v1/admin/employees/${employeeId}/probation/complete`)
      .set(hr())
      .send({ effectiveDate: '2026-03-02', reason: 'Đạt yêu cầu thử việc' })
      .expect(200);

    const contract = await EmployeeContractModel.findOne({ employeeId, status: 'active' });
    expect(contract?.employmentStatus).toBe('official');
    const employee = await Employee.findById(employeeId);
    expect(employee?.status).toBe('active');
    expect(await EmployeeHistory.countDocuments({ employeeId, eventType: 'probation_completed' })).toBe(1);
  });

  it('hoàn tất thử việc khi hợp đồng đã chính thức → 422', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `PRB2${uniq()}`);
    await addContract(employeeId, { employmentStatus: 'official' });

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/probation/complete`)
      .set(hr())
      .send({ effectiveDate: '2026-03-02', reason: 'Sai luồng' });

    expect(res.status).toBe(422);
  });

  it('gia hạn thử việc dời ngày kết thúc và lưu mốc cũ trong lịch sử', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `EXT${uniq()}`);
    await addContract(employeeId, { employmentStatus: 'probation', endDate: '2026-03-01' });

    await api
      .post(`/api/v1/admin/employees/${employeeId}/probation/extend`)
      .set(hr())
      .send({ newEndDate: '2026-04-01', reason: 'Cần thêm thời gian đánh giá' })
      .expect(200);

    const contract = await EmployeeContractModel.findOne({ employeeId, status: 'active' });
    expect(contract?.endDate?.toISOString().slice(0, 10)).toBe('2026-04-01');

    const event = await EmployeeHistory.findOne({ employeeId, eventType: 'probation_extended' });
    expect(String(event?.fromValue?.probationEndDate)).toContain('2026-03-01');
  });

  it('gia hạn về ngày sớm hơn hiện tại → 422', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `EXT2${uniq()}`);
    await addContract(employeeId, { employmentStatus: 'probation', endDate: '2026-03-01' });

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/probation/extend`)
      .set(hr())
      .send({ newEndDate: '2026-02-01', reason: 'Rút ngắn' });

    expect(res.status).toBe(422);
  });
});

describe('Thay đổi lương', () => {
  it('lập hợp đồng mới, đóng hợp đồng cũ và GIỮ NGUYÊN mức lương cũ trên bản ghi cũ', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `SAL${uniq()}`);
    const old = await addContract(employeeId, { employmentStatus: 'official' });

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/change-salary`)
      .set(hr())
      .send({
        newBaseSalary: 20_000_000,
        contractNumber: `PL-${uniq()}`,
        effectiveDate: '2026-07-01',
        reason: 'Điều chỉnh lương giữa năm',
      });

    expect(res.status).toBe(201);

    const contracts = await EmployeeContractModel.find({ employeeId }).sort({ startDate: 1 });
    expect(contracts).toHaveLength(2);
    const previous = contracts.find((c) => String(c._id) === String(old._id))!;
    expect(String(previous.baseSalary)).toBe('15000000');
    expect(previous.status).toBe('expired');
    expect(previous.endDate?.toISOString().slice(0, 10)).toBe('2026-07-01');

    const current = contracts.find((c) => c.status === 'active')!;
    expect(String(current.baseSalary)).toBe('20000000');

    const event = await EmployeeHistory.findOne({ employeeId, eventType: 'salary_change' });
    expect(event?.fromValue).toMatchObject({ baseSalary: '15000000' });
    expect(event?.toValue).toMatchObject({ baseSalary: '20000000' });
  });

  it('mức lương mới trùng mức cũ → 422', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `SAL2${uniq()}`);
    await addContract(employeeId, { employmentStatus: 'official' });

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/change-salary`)
      .set(hr())
      .send({
        newBaseSalary: 15_000_000,
        contractNumber: `PL-${uniq()}`,
        effectiveDate: '2026-07-01',
        reason: 'Không đổi',
      });

    expect(res.status).toBe(422);
  });
});

describe('Nghỉ việc & tái tuyển', () => {
  it('nghỉ theo nguyện vọng: giữ nguyên hồ sơ, đóng hợp đồng, ghi sự kiện `resigned`', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `RES${uniq()}`);
    await addContract(employeeId, { employmentStatus: 'official' });

    await api
      .post(`/api/v1/admin/employees/${employeeId}/end-employment`)
      .set(hr())
      .send({
        separationType: 'resignation',
        noticeDate: '2026-08-01',
        lastWorkingDate: '2026-08-31',
        reason: 'Nhân viên xin nghỉ',
      })
      .expect(200);

    const employee = await Employee.findById(employeeId);
    expect(employee).toBeTruthy(); // KHÔNG xoá cứng
    expect(employee?.status).toBe('terminated');
    expect(employee?.terminationDate?.toISOString().slice(0, 10)).toBe('2026-08-31');

    const contract = await EmployeeContractModel.findOne({ employeeId });
    expect(contract?.status).toBe('terminated');

    const event = await EmployeeHistory.findOne({ employeeId, eventType: 'resigned' });
    expect(event?.toValue).toMatchObject({ separationType: 'resignation' });
  });

  it('chấm dứt từ phía công ty ghi sự kiện `terminated`', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `TERM${uniq()}`);

    await api
      .post(`/api/v1/admin/employees/${employeeId}/end-employment`)
      .set(hr())
      .send({ separationType: 'termination', lastWorkingDate: '2026-08-31', reason: 'Vi phạm nội quy' })
      .expect(200);

    expect(await EmployeeHistory.countDocuments({ employeeId, eventType: 'terminated' })).toBe(1);
  });

  it('người đã nghỉ không nhận thêm thay đổi vòng đời (409)', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `LOCK${uniq()}`);
    await api
      .post(`/api/v1/admin/employees/${employeeId}/end-employment`)
      .set(hr())
      .send({ separationType: 'resignation', lastWorkingDate: '2026-08-31', reason: 'Nghỉ' })
      .expect(200);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/transfer`)
      .set(hr())
      .send({ newDepartmentId: org.productId, effectiveDate: '2026-09-01', reason: 'Sau khi nghỉ' });

    expect(res.status).toBe(409);
  });

  it('tái tuyển dùng lại đúng bản ghi cũ: giữ mã, giữ toàn bộ lịch sử', async () => {
    const org = await seedOrg();
    const code = `REH${uniq()}`;
    const employeeId = await createEmployee(org, code);
    await api
      .post(`/api/v1/admin/employees/${employeeId}/end-employment`)
      .set(hr())
      .send({ separationType: 'resignation', lastWorkingDate: '2026-08-31', reason: 'Nghỉ' })
      .expect(200);

    const before = await EmployeeHistory.countDocuments({ employeeId });

    await api
      .post(`/api/v1/admin/employees/${employeeId}/rehire`)
      .set(hr())
      .send({
        rehireDate: '2026-09-15',
        departmentId: org.productId,
        positionId: org.seniorId,
        reason: 'Quay lại công ty',
        contract: {
          contractType: 'fixed_term',
          contractNumber: `HD-${uniq()}`,
          startDate: '2026-09-15',
          baseSalary: 18_000_000,
        },
      })
      .expect(200);

    // Vẫn là một nhân viên duy nhất, không tạo bản trùng.
    expect(await Employee.countDocuments({ employeeCode: code })).toBe(1);
    const employee = await Employee.findById(employeeId);
    expect(employee?.status).toBe('onboarding');
    expect(employee?.terminationDate).toBeNull();
    expect(String(employee?.departmentId)).toBe(org.productId);

    // Lịch sử cũ còn nguyên, chỉ được cộng thêm.
    expect(await EmployeeHistory.countDocuments({ employeeId })).toBe(before + 1);
    expect(await EmployeeHistory.countDocuments({ employeeId, eventType: 'rehired' })).toBe(1);
  });

  it('tái tuyển người đang làm việc → 409', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `ACT${uniq()}`);

    const res = await api
      .post(`/api/v1/admin/employees/${employeeId}/rehire`)
      .set(hr())
      .send({ rehireDate: '2026-09-15', departmentId: org.productId, positionId: org.devId, reason: 'Sai luồng' });

    expect(res.status).toBe(409);
  });
});

describe('Dòng thời gian vòng đời', () => {
  it('trả sự kiện đã diễn giải: tên phòng ban thay vì ObjectId, kèm lý do', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `TL${uniq()}`);
    await api
      .post(`/api/v1/admin/employees/${employeeId}/transfer`)
      .set(hr())
      .send({ newDepartmentId: org.productId, effectiveDate: '2026-06-15', reason: 'Sang Product' })
      .expect(200);

    const res = await api.get(`/api/v1/employees/${employeeId}/lifecycle`).set(hr());

    expect(res.status).toBe(200);
    const transfer = (res.body.data as { eventType: string; changes: { label: string; from: string; to: string }[]; reason: string }[])
      .find((e) => e.eventType === 'transfer')!;
    expect(transfer.reason).toBe('Sang Product');
    const department = transfer.changes.find((c) => c.label === 'Phòng ban')!;
    expect(department.from).toBe('Engineering');
    expect(department.to).toBe('Product');
  });

  it('nhân viên khác không xem được dòng thời gian của người lạ (403)', async () => {
    const org = await seedOrg();
    const employeeId = await createEmployee(org, `TL2${uniq()}`);

    const res = await api
      .get(`/api/v1/employees/${employeeId}/lifecycle`)
      .set(bearer(tokenFor(['employee']).token));

    expect(res.status).toBe(403);
  });
});
