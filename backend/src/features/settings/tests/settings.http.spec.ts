import { vi } from 'vitest';
/**
 * TIER 4 — HTTP integration: Settings (company config, salary policy, criteria).
 * This area had ZERO automated coverage. Focuses on guards (adminOnly vs
 * hrOrAdmin) and the validation invariants that protect payroll:
 *   • salary-policy component weights must sum to 100 (PAY-4)
 *   • a criterion's `type` cannot be changed on update (PERF-4, strict DTO)
 */
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@shared/testing/http';

vi.setConfig({ testTimeout: 60_000 });

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const admin = () => bearer(tokenFor(['admin']).token);
const hr = () => bearer(tokenFor(['hr_manager']).token);
const emp = () => bearer(tokenFor(['employee']).token);

const validPolicy = (over: Record<string, unknown> = {}) => ({
  country: 'VN', year: 2026, effectiveFrom: '2026-01-01', baseSalary: 2_340_000,
  salaryComponentWeights: { attendance: 20, performance: 60, goal: 20 },
  ...over,
});

describe('Company config', () => {
  it('admin can update company config (200)', async () => {
    const res = await api.patch('/api/v1/admin/settings/company').set(admin()).send({ companyName: 'Soosky' });
    expect(res.status).toBe(200);
  });

  it('hr_manager CANNOT update company config — adminOnly (403)', async () => {
    const res = await api.patch('/api/v1/admin/settings/company').set(hr()).send({ companyName: 'X' });
    expect(res.status).toBe(403);
  });

  it('any authenticated user can read company config (200)', async () => {
    const res = await api.get('/api/v1/settings/company').set(emp());
    expect(res.status).toBe(200);
  });
});

describe('Salary policy', () => {
  it('admin creates a valid policy (weights sum 100)', async () => {
    const res = await api.post('/api/v1/admin/settings/salary-policies').set(admin()).send(validPolicy());
    expect([200, 201]).toContain(res.status);
  });

  it('rejects component weights that do NOT sum to 100 (PAY-4, 4xx)', async () => {
    const res = await api
      .post('/api/v1/admin/settings/salary-policies')
      .set(admin())
      .send(validPolicy({ salaryComponentWeights: { attendance: 30, performance: 60, goal: 20 } }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('hr_manager CANNOT create a salary policy — adminOnly (403)', async () => {
    const res = await api.post('/api/v1/admin/settings/salary-policies').set(hr()).send(validPolicy());
    expect(res.status).toBe(403);
  });

  it('hr_manager CAN list salary policies (200)', async () => {
    const res = await api.get('/api/v1/settings/salary-policies').set(hr());
    expect(res.status).toBe(200);
  });
});

describe('Performance criteria', () => {
  it('hr creates then archives a criterion', async () => {
    const create = await api
      .post('/api/v1/admin/settings/performance-criteria')
      .set(hr())
      .send({ label: 'Code quality', type: 'performance' });
    expect(create.status).toBe(201);
    const id = create.body.data._id ?? create.body.data.id;

    const archive = await api.delete(`/api/v1/admin/settings/performance-criteria/${id}`).set(hr());
    expect(archive.status).toBe(200);
  });

  it("a criterion's type CANNOT be changed on update (PERF-4, strict DTO 4xx)", async () => {
    const create = await api
      .post('/api/v1/admin/settings/performance-criteria')
      .set(hr())
      .send({ label: 'Teamwork', type: 'performance' });
    const id = create.body.data._id ?? create.body.data.id;

    const res = await api
      .patch(`/api/v1/admin/settings/performance-criteria/${id}`)
      .set(hr())
      .send({ type: 'goal' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('plain employee CANNOT create a criterion (403)', async () => {
    const res = await api
      .post('/api/v1/admin/settings/performance-criteria')
      .set(emp())
      .send({ label: 'X', type: 'goal' });
    expect(res.status).toBe(403);
  });
});
