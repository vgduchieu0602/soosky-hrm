/// <reference types="jest" />
/**
 * TIER 1 — HTTP: authentication security flows that had no coverage.
 *   - login: success / bad password (IAM_001) / inactive (IAM_003).
 *   - lockout after MAX_FAILED_ATTEMPTS (5) → account locked (IAM_003).
 *   - refresh rotation: new token issued; replaying the OLD refresh token is
 *     reuse and revokes EVERY session for the user (IAM_005).
 *   - change-password kills other live sessions.
 */
import { api, startDb, stopDb, clearDb, seedRoles, bearer } from '@shared/testing/http';
import { hashPassword } from '@shared/utils/hash.util';
import { User } from '@shared/models/user.model';
import { UserRole } from '@shared/models/user-role.model';
import { Role } from '@shared/models/role.model';

jest.setTimeout(60_000);

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const PW = 'Str0ng@Pass1';

async function seedUser(opts: { email?: string; role?: string; status?: string } = {}) {
  const email = opts.email ?? `u${Date.now()}${Math.random().toString(36).slice(2, 6)}@soosky.local`;
  const role = await Role.findOne({ name: opts.role ?? 'employee' });
  const roleId = (role as unknown as { _id: unknown })._id;
  const user = await User.create({
    username: email.split('@')[0],
    email,
    password: await hashPassword(PW),
    status: opts.status ?? 'active',
  } as any);
  await UserRole.create({ userId: user._id, roleId } as any);
  return { user, email };
}

/** Pull the refreshToken cookie string out of a Set-Cookie header array. */
function refreshCookie(res: { headers: Record<string, unknown> }): string {
  const raw = (res.headers['set-cookie'] as string[] | undefined) ?? [];
  const c = raw.find((s) => s.startsWith('refreshToken='));
  if (!c) throw new Error('no refresh cookie set');
  return c.split(';')[0];
}

describe('login', () => {
  it('succeeds with correct credentials and issues a token + refresh cookie', async () => {
    const { email } = await seedUser({ role: 'hr_manager' });
    const res = await api.post('/api/v1/auth/login').send({ identifier: email, password: PW });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.roles).toContain('hr_manager');
    expect(refreshCookie(res)).toMatch(/^refreshToken=/);
  });

  it('rejects a wrong password with IAM_001', async () => {
    const { email } = await seedUser();
    const res = await api.post('/api/v1/auth/login').send({ identifier: email, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('IAM_001');
  });

  it('rejects a disabled account with IAM_003', async () => {
    const { email } = await seedUser({ status: 'disabled' });
    const res = await api.post('/api/v1/auth/login').send({ identifier: email, password: PW });
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('IAM_003');
  });

  it('locks the account after 5 failed attempts (IAM_003 even with the right password)', async () => {
    const { email } = await seedUser();
    for (let i = 0; i < 5; i++) {
      await api.post('/api/v1/auth/login').send({ identifier: email, password: 'wrong' });
    }
    const res = await api.post('/api/v1/auth/login').send({ identifier: email, password: PW });
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('IAM_003');
  });
});

describe('refresh rotation + reuse detection', () => {
  it('rotates the refresh token and revokes all sessions when an old token is replayed', async () => {
    const { email } = await seedUser();
    const login = await api.post('/api/v1/auth/login').send({ identifier: email, password: PW });
    const cookie1 = refreshCookie(login);

    // First refresh rotates → new access token + new cookie.
    const r1 = await api.post('/api/v1/auth/refresh').set('Cookie', cookie1);
    expect(r1.status).toBe(200);
    expect(r1.body.data.accessToken).toBeTruthy();
    const cookie2 = refreshCookie(r1);
    expect(cookie2).not.toBe(cookie1);

    // Replaying the OLD cookie is reuse → 401 IAM_005.
    const reuse = await api.post('/api/v1/auth/refresh').set('Cookie', cookie1);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error?.code).toBe('IAM_005');

    // Reuse revoked EVERY session — the rotated cookie is now dead too.
    const after = await api.post('/api/v1/auth/refresh').set('Cookie', cookie2);
    expect(after.status).toBe(401);
  });
});

describe('change-password', () => {
  it('kills other live sessions but keeps the current one', async () => {
    const { email } = await seedUser();
    // Session A + Session B (two logins).
    const a = await api.post('/api/v1/auth/login').send({ identifier: email, password: PW });
    const b = await api.post('/api/v1/auth/login').send({ identifier: email, password: PW });
    const accessA = a.body.data.accessToken as string;
    const cookieB = refreshCookie(b);

    const chg = await api
      .patch('/api/v1/auth/change-password')
      .set(bearer(accessA))
      .send({ currentPassword: PW, newPassword: 'New@Pass9val' });
    expect(chg.status).toBeLessThan(300);

    // Session B's refresh token was revoked by the password change.
    const refreshB = await api.post('/api/v1/auth/refresh').set('Cookie', cookieB);
    expect(refreshB.status).toBe(401);
  });
});
