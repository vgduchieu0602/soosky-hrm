import { vi } from 'vitest';
/**
 * TIER 1 — HTTP integration cho vòng đời phiên đăng nhập.
 *
 * Điều được khoá: cookie refresh khôi phục được phiên sau khi tải lại trang;
 * đổi mật khẩu trả access token MỚI (không còn cờ bắt đổi) nên người dùng không
 * kẹt vòng 403; và đăng xuất thu hồi phiên thật sự.
 */
import { api, startDb, stopDb, clearDb, seedRoles, bearer } from '@/test-support/http';
import { User } from '@shared/models/user.model';
import { Role } from '@shared/models/role.model';
import { UserRole } from '@shared/models/user-role.model';
import { Session } from '@shared/models/session.model';
import { hashPassword } from '@shared/utils/hash.util';

vi.setConfig({ testTimeout: 90_000 });

beforeAll(startDb);
afterAll(stopDb);
beforeEach(seedRoles);
afterEach(clearDb);

const PASSWORD = 'Passw0rd@123';

async function makeUser(opts: { roleName: string; mustChangePassword?: boolean } ) {
  const suffix = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const user = await User.create({
    username: `u${suffix}`,
    email: `u${suffix}@soosky.local`,
    password: await hashPassword(PASSWORD),
    status: 'active',
    mustChangePassword: opts.mustChangePassword ?? false,
  });
  const role = await Role.findOne({ name: opts.roleName });
  await UserRole.create({ userId: user._id, roleId: role!._id, assignedAt: new Date() });
  return user;
}

/** Cookie refresh nằm ở `Set-Cookie`; supertest trả mảng chuỗi thô. */
function refreshCookie(res: { headers: Record<string, unknown> }): string {
  const raw = (res.headers['set-cookie'] as string[] | undefined) ?? [];
  const cookie = raw.find((c) => c.startsWith('refreshToken='));
  return cookie ?? '';
}

async function login(identifier: string) {
  return api.post('/api/v1/auth/login').send({ identifier, password: PASSWORD });
}

describe('Đăng nhập', () => {
  it('trả access token + user và đặt cookie refresh httpOnly', async () => {
    const user = await makeUser({ roleName: 'hr_manager' });

    const res = await login(user.username);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user).toMatchObject({ username: user.username, roles: ['hr_manager'] });

    const cookie = refreshCookie(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api/v1/auth');
    // Ở môi trường test (không phải production) không gắn Secure để chạy được HTTP.
    expect(cookie).not.toContain('Secure');
  });

  it('sai mật khẩu → 401, không cấp cookie', async () => {
    const user = await makeUser({ roleName: 'employee' });

    const res = await api.post('/api/v1/auth/login').send({ identifier: user.username, password: 'sai' });

    expect(res.status).toBe(401);
    expect(refreshCookie(res)).toBe('');
  });
});

describe('Khôi phục phiên', () => {
  it('cookie refresh hợp lệ → cấp access token mới, /auth/me trả danh tính chuẩn', async () => {
    const user = await makeUser({ roleName: 'hr_manager' });
    const logged = await login(user.username);

    const refreshed = await api
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie(logged));

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeTruthy();

    const me = await api.get('/api/v1/auth/me').set(bearer(refreshed.body.data.accessToken));

    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ username: user.username, roles: ['hr_manager'] });
  });

  it('không có cookie → 401 (không có phiên để khôi phục)', async () => {
    const res = await api.post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
  });

  it('cookie rác → 401', async () => {
    const res = await api.post('/api/v1/auth/refresh').set('Cookie', 'refreshToken=khong-hop-le');

    expect(res.status).toBe(401);
  });

  it('refresh xoay vòng token: cookie cũ dùng lại bị từ chối', async () => {
    const user = await makeUser({ roleName: 'employee' });
    const logged = await login(user.username);
    const oldCookie = refreshCookie(logged);

    await api.post('/api/v1/auth/refresh').set('Cookie', oldCookie).expect(200);

    const reuse = await api.post('/api/v1/auth/refresh').set('Cookie', oldCookie);

    expect(reuse.status).toBe(401);
  });
});

describe('Đổi mật khẩu bắt buộc', () => {
  it('token có cờ mustChangePassword bị chặn ở API thường (403 IAM_013)', async () => {
    const user = await makeUser({ roleName: 'hr_manager', mustChangePassword: true });
    const logged = await login(user.username);

    const res = await api.get('/api/v1/employees').set(bearer(logged.body.data.accessToken));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('IAM_013');
  });

  it('đổi mật khẩu trả access token MỚI dùng được ngay', async () => {
    const user = await makeUser({ roleName: 'hr_manager', mustChangePassword: true });
    const logged = await login(user.username);

    const changed = await api
      .patch('/api/v1/auth/change-password')
      .set(bearer(logged.body.data.accessToken))
      .send({ currentPassword: PASSWORD, newPassword: 'Newpass@456' });

    expect(changed.status).toBe(200);
    const fresh = changed.body.data.accessToken as string;
    expect(fresh).toBeTruthy();
    expect(fresh).not.toBe(logged.body.data.accessToken);

    // Token mới vào được API thường; token cũ thì không.
    await api.get('/api/v1/employees').set(bearer(fresh)).expect(200);
    await api.get('/api/v1/employees').set(bearer(logged.body.data.accessToken)).expect(403);

    // /auth/me phản ánh đúng trạng thái đã đổi.
    const me = await api.get('/api/v1/auth/me').set(bearer(fresh));
    expect(me.body.data.mustChangePassword).toBe(false);
  });

  it('mật khẩu hiện tại sai → 400, không cấp token mới', async () => {
    const user = await makeUser({ roleName: 'employee', mustChangePassword: true });
    const logged = await login(user.username);

    const res = await api
      .patch('/api/v1/auth/change-password')
      .set(bearer(logged.body.data.accessToken))
      .send({ currentPassword: 'sai-mat-khau', newPassword: 'Newpass@456' });

    expect(res.status).toBe(400);
    expect(res.body.data?.accessToken).toBeUndefined();
  });
});

describe('Đăng xuất', () => {
  it('thu hồi phiên: cookie refresh cũ không dùng lại được', async () => {
    const user = await makeUser({ roleName: 'employee' });
    const logged = await login(user.username);
    const cookie = refreshCookie(logged);

    await api
      .post('/api/v1/auth/logout')
      .set(bearer(logged.body.data.accessToken))
      .set('Cookie', cookie)
      .expect(200);

    expect(await Session.countDocuments({ revokedAt: { $ne: null } })).toBeGreaterThan(0);
    const res = await api.post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });

  it('không có token → 401', async () => {
    await api.post('/api/v1/auth/logout').expect(401);
  });
});
