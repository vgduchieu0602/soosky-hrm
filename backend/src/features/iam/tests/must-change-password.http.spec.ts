/// <reference types="jest" />
/**
 * TIER 1 — HTTP: forced-password-change enforcement (IAM_013).
 * A user flagged `mustChangePassword` is blocked from every API except the
 * allowlist (/auth/change-password, /auth/logout, /auth/me). This rule lives in
 * the authenticate middleware and had no automated coverage — it is the
 * server-side backstop that makes the FE MustChangePasswordRoute non-bypassable.
 */
import { api, bearer, tokenFor, startDb, stopDb, clearDb, seedRoles } from '@shared/testing/http';

jest.setTimeout(60_000);

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

describe('must-change-password guard (IAM_013)', () => {
  it('blocks a normal API for a flagged user with 403 IAM_013', async () => {
    const { token } = tokenFor(['employee'], { mustChangePassword: true });
    const res = await api.get('/api/v1/employees').set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('IAM_013');
  });

  it('blocks an admin-scoped API too — flag overrides role', async () => {
    const { token } = tokenFor(['admin'], { mustChangePassword: true });
    const res = await api.get('/api/v1/users').set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('IAM_013');
  });

  it('allows the allowlisted /auth/me (never IAM_013)', async () => {
    const { token } = tokenFor(['employee'], { mustChangePassword: true });
    const res = await api.get('/api/v1/auth/me').set(bearer(token));
    expect(res.body.error?.code).not.toBe('IAM_013');
  });

  it('does NOT block a user without the flag', async () => {
    const { token } = tokenFor(['employee']);
    const res = await api.get('/api/v1/employees').set(bearer(token));
    expect(res.status).not.toBe(403);
  });

  it('still rejects a missing token before the flag check (401)', async () => {
    const res = await api.get('/api/v1/employees');
    expect(res.status).toBe(401);
  });
});
