import { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { comparePassword, hashRefreshToken } from '@shared/utils/hash.util';
import { eventBus } from '@core/events/event-bus';
import { logger } from '@core/logger/logger';

import { User } from '@shared/models/user.model';
import { userRepository } from '@features/iam/repositories/user.repository';
import { roleRepository } from '@features/iam/repositories/role.repository';
import { permissionRepository } from '@features/iam/repositories/permission.repository';
import { sessionRepository } from '@features/iam/repositories/session.repository';
import { tokenService } from '@features/iam/services/token.service';
import { auditService } from '@features/iam/services/audit.service';

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

async function resolveRolesAndPermissions(userId: string) {
  const { ids, names } = await roleRepository.findActiveByUserId(userId);
  const permissions = await permissionRepository.findKeysByRoleIds(ids);
  return { roleNames: names, permissions };
}

export const authService = {
  async login(identifier: string, password: string, ctx: ClientCtx): Promise<LoginResult> {
    const user = await userRepository.findByIdentifier(identifier);

    if (!user) {
      await auditService.record({
        resource: 'auth',
        action: 'login-failed',
        changes: { identifier, reason: 'user-not-found', ip: ctx.ip, userAgent: ctx.userAgent },
      });
      throw new HttpError(401, 'Invalid credentials', 'IAM_001');
    }

    const userId = user._id.toString();

    if (user.status !== 'active') {
      await auditService.record({
        userId,
        resource: 'auth',
        action: 'login-blocked',
        changes: { status: user.status, ip: ctx.ip },
      });
      throw new HttpError(403, `Account ${user.status}`, 'IAM_003');
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
      const { attempts, locked } = await userRepository.incrementFailedAttempts(userId);
      await auditService.record({
        userId,
        resource: 'auth',
        action: 'login-failed',
        changes: { attempts, locked, ip: ctx.ip },
      });
      if (locked) {
        eventBus.emit('iam.user.locked', { userId, reason: 'too-many-failed-attempts' });
      }
      throw new HttpError(401, 'Invalid credentials', 'IAM_001');
    }

    const { roleNames, permissions } = await resolveRolesAndPermissions(userId);
    const sessionId = new Types.ObjectId();
    const sessionIdStr = sessionId.toString();

    const refreshToken = tokenService.signRefresh({
      userId,
      sessionId: sessionIdStr,
      tokenVersion: 0,
    });
    const accessToken = tokenService.signAccess({
      userId,
      sessionId: sessionIdStr,
      roles: roleNames,
      permissions,
      mustChangePassword: user.mustChangePassword,
    });

    await sessionRepository.create({
      sessionId,
      userId,
      refreshToken,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
      expiresAt: new Date(Date.now() + tokenService.refreshTtlMs()),
    });

    await userRepository.resetLoginState(userId);

    eventBus.emit('iam.user.logged-in', {
      userId,
      sessionId: sessionIdStr,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    await auditService.record({
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
  },

  async refresh(rawToken: string | undefined, ctx: ClientCtx) {
    if (!rawToken) {
      throw new HttpError(401, 'Refresh token missing', 'IAM_005');
    }

    let payload;
    try {
      payload = tokenService.verifyRefresh(rawToken);
    } catch {
      throw new HttpError(401, 'Refresh token invalid', 'IAM_005');
    }

    const { sub: userId, sessionId, tokenVersion } = payload;
    const hash = hashRefreshToken(rawToken);
    const session = await sessionRepository.findActiveByIdAndHash(sessionId, hash);

    if (!session) {
      // Reuse detection: token verified but no active session matches.
      await sessionRepository.revokeAllForUser(userId);
      eventBus.emit('iam.session.reuse-detected', { userId });
      await auditService.record({
        userId,
        resource: 'session',
        action: 'session-reuse',
        resourceId: sessionId,
        changes: { ip: ctx.ip, userAgent: ctx.userAgent },
      });
      throw new HttpError(401, 'Refresh token invalid', 'IAM_005');
    }

    const user = await userRepository.findById(userId);
    if (!user || user.status !== 'active') {
      await sessionRepository.revoke(sessionId);
      throw new HttpError(401, 'Refresh token invalid', 'IAM_005');
    }

    const { roleNames, permissions } = await resolveRolesAndPermissions(userId);

    const newRefreshToken = tokenService.signRefresh({
      userId,
      sessionId,
      tokenVersion: tokenVersion + 1,
    });
    const accessToken = tokenService.signAccess({
      userId,
      sessionId,
      roles: roleNames,
      permissions,
      mustChangePassword: user.mustChangePassword,
    });

    await sessionRepository.rotate(
      sessionId,
      newRefreshToken,
      new Date(Date.now() + tokenService.refreshTtlMs()),
    );

    await auditService.record({
      userId,
      resource: 'auth',
      action: 'refresh',
      resourceId: sessionId,
      changes: { ip: ctx.ip },
    });

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(userId: string, sessionId: string | undefined, ctx: ClientCtx) {
    if (!sessionId) return;
    await sessionRepository.revoke(sessionId);
    eventBus.emit('iam.session.revoked', { userId, sessionId });
    await auditService.record({
      userId,
      resource: 'auth',
      action: 'logout',
      resourceId: sessionId,
      changes: { ip: ctx.ip },
    });
  },

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await User.findById(userId);
    if (!user) throw new HttpError(401, 'User not found', 'IAM_002');
    const { roleNames, permissions } = await resolveRolesAndPermissions(userId);
    return {
      id: userId,
      username: user.username,
      email: user.email,
      roles: roleNames,
      permissions,
      mustChangePassword: user.mustChangePassword,
    };
  },
};
