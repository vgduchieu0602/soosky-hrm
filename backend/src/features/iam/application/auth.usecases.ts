import { HttpError } from '@shared/errors/http-error';
import { logger } from '@core/logger/logger';
import type {
  UserRepository,
  RoleRepository,
  PermissionRepository,
  SessionRepository,
  TokenIssuer,
  PasswordHasher,
  RefreshTokenHasher,
  AuditPort,
  EventsPort,
  Clock,
} from '@features/iam/domain/ports';

const log = logger.child({ feature: 'iam', module: 'auth' });

interface ClientCtx {
  ip?: string;
  userAgent?: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

export class AuthUseCases {
  constructor(
    private readonly users: UserRepository,
    private readonly roles: RoleRepository,
    private readonly permissions: PermissionRepository,
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenIssuer,
    private readonly hasher: PasswordHasher,
    private readonly refreshHasher: RefreshTokenHasher,
    private readonly audit: AuditPort,
    private readonly events: EventsPort,
    private readonly clock: Clock,
  ) {}

  private async resolveRolesAndPermissions(userId: string) {
    const { ids, names } = await this.roles.findActiveByUserId(userId);
    const permissions = await this.permissions.findKeysByRoleIds(ids);
    return { roleNames: names, permissions };
  }

  async login(identifier: string, password: string, ctx: ClientCtx): Promise<LoginResult> {
    const user = await this.users.findByIdentifier(identifier);

    if (!user) {
      await this.audit.record({
        resource: 'auth',
        action: 'login-failed',
        changes: { identifier, reason: 'user-not-found', ip: ctx.ip, userAgent: ctx.userAgent },
      });
      throw new HttpError(401, 'Invalid credentials', 'IAM_001');
    }

    const userId = user.id;

    if (user.status !== 'active') {
      await this.audit.record({
        userId,
        resource: 'auth',
        action: 'login-blocked',
        changes: { status: user.status, ip: ctx.ip },
      });
      throw new HttpError(403, `Account ${user.status}`, 'IAM_003');
    }

    const ok = await this.hasher.compare(password, user.password);
    if (!ok) {
      const { attempts, locked } = await this.users.incrementFailedAttempts(userId);
      await this.audit.record({
        userId,
        resource: 'auth',
        action: 'login-failed',
        changes: { attempts, locked, ip: ctx.ip },
      });
      if (locked) {
        this.events.userLocked({ userId, reason: 'too-many-failed-attempts' });
      }
      throw new HttpError(401, 'Invalid credentials', 'IAM_001');
    }

    const { roleNames, permissions } = await this.resolveRolesAndPermissions(userId);
    const sessionIdStr = this.sessions.newSessionId();

    const refreshToken = this.tokens.signRefresh({
      userId,
      sessionId: sessionIdStr,
      tokenVersion: 0,
    });
    const accessToken = this.tokens.signAccess({
      userId,
      sessionId: sessionIdStr,
      roles: roleNames,
      permissions,
      mustChangePassword: user.mustChangePassword,
    });

    await this.sessions.create({
      sessionId: sessionIdStr,
      userId,
      refreshToken,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
      expiresAt: new Date(this.clock.now().getTime() + this.tokens.refreshTtlMs()),
    });

    await this.users.resetLoginState(userId);

    this.events.userLoggedIn({
      userId,
      sessionId: sessionIdStr,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    await this.audit.record({
      userId,
      resource: 'auth',
      action: 'login',
      resourceId: sessionIdStr,
      changes: { ip: ctx.ip, userAgent: ctx.userAgent },
    });

    log.info({ userId, sessionId: sessionIdStr }, 'login success');

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        roles: roleNames,
        permissions,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async refresh(rawToken: string | undefined, ctx: ClientCtx) {
    if (!rawToken) {
      throw new HttpError(401, 'Refresh token missing', 'IAM_005');
    }

    let payload;
    try {
      payload = this.tokens.verifyRefresh(rawToken);
    } catch {
      throw new HttpError(401, 'Refresh token invalid', 'IAM_005');
    }

    const { sub: userId, sessionId, tokenVersion } = payload;
    const hash = this.refreshHasher.hash(rawToken);
    const session = await this.sessions.findActiveByIdAndHash(sessionId, hash);

    if (!session) {
      // Reuse detection: token verified but no active session matches.
      await this.sessions.revokeAllForUser(userId);
      this.events.sessionReuseDetected({ userId });
      await this.audit.record({
        userId,
        resource: 'session',
        action: 'session-reuse',
        resourceId: sessionId,
        changes: { ip: ctx.ip, userAgent: ctx.userAgent },
      });
      throw new HttpError(401, 'Refresh token invalid', 'IAM_005');
    }

    const user = await this.users.findAuthById(userId);
    if (!user || user.status !== 'active') {
      await this.sessions.revoke(sessionId);
      throw new HttpError(401, 'Refresh token invalid', 'IAM_005');
    }

    const { roleNames, permissions } = await this.resolveRolesAndPermissions(userId);

    const newRefreshToken = this.tokens.signRefresh({
      userId,
      sessionId,
      tokenVersion: tokenVersion + 1,
    });
    const accessToken = this.tokens.signAccess({
      userId,
      sessionId,
      roles: roleNames,
      permissions,
      mustChangePassword: user.mustChangePassword,
    });

    await this.sessions.rotate(
      sessionId,
      newRefreshToken,
      new Date(this.clock.now().getTime() + this.tokens.refreshTtlMs()),
    );

    await this.audit.record({
      userId,
      resource: 'auth',
      action: 'refresh',
      resourceId: sessionId,
      changes: { ip: ctx.ip },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string, sessionId: string | undefined, ctx: ClientCtx) {
    if (!sessionId) return;
    await this.sessions.revoke(sessionId);
    this.events.sessionRevoked({ userId, sessionId });
    await this.audit.record({
      userId,
      resource: 'auth',
      action: 'logout',
      resourceId: sessionId,
      changes: { ip: ctx.ip },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId?: string,
  ) {
    const user = await this.users.findPasswordById(userId);
    if (!user) throw new HttpError(401, 'User not found', 'IAM_002');

    const ok = await this.hasher.compare(currentPassword, user.password);
    if (!ok) throw new HttpError(400, 'Mật khẩu hiện tại không đúng', 'IAM_011');

    if (await this.hasher.compare(newPassword, user.password)) {
      throw new HttpError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại', 'IAM_012');
    }

    await this.users.setPassword(userId, await this.hasher.hash(newPassword));

    // Kill every other live session so a previously-stolen refresh token dies
    // with the old password; keep the current device signed in.
    if (currentSessionId) {
      await this.sessions.revokeAllForUserExcept(userId, currentSessionId);
    } else {
      await this.sessions.revokeAllForUser(userId);
    }

    this.events.passwordChanged({ userId });
    await this.audit.record({
      userId,
      resource: 'user',
      action: 'update',
      resourceId: userId,
      changes: { passwordChanged: true },
    });

    log.info({ userId }, 'password changed by user');

    // Access token đang cầm vẫn mang `mustChangePassword: true`; nếu không cấp
    // token mới thì mọi request sau đó bị chặn bởi IAM_013 và người dùng kẹt
    // vòng "đổi mật khẩu → dashboard → 403 → đổi mật khẩu". Cấp lại token cho
    // đúng phiên hiện tại; refresh token và phiên không đổi.
    let accessToken: string | undefined;
    if (currentSessionId) {
      const { roleNames, permissions } = await this.resolveRolesAndPermissions(userId);
      accessToken = this.tokens.signAccess({
        userId,
        sessionId: currentSessionId,
        roles: roleNames,
        permissions,
        mustChangePassword: false,
      });
    }

    return { ok: true, accessToken };
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.users.findAuthById(userId);
    if (!user) throw new HttpError(401, 'User not found', 'IAM_002');
    const { roleNames, permissions } = await this.resolveRolesAndPermissions(userId);
    return {
      id: userId,
      username: user.username,
      email: user.email,
      roles: roleNames,
      permissions,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
