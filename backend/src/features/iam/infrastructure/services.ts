import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { eventBus } from '@infra/events/event-bus';
import { comparePassword, hashPassword, hashRefreshToken } from '@modules/auth/adapters/security/hash.util';
import type {
  Clock,
  PasswordHasher,
  RefreshTokenHasher,
  TokenHasher,
  IdValidator,
  EventsPort,
  Id,
} from '@features/iam/domain/ports';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class BcryptPasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return hashPassword(plain);
  }
  compare(plain: string, hash: string): Promise<boolean> {
    return comparePassword(plain, hash);
  }
}

export class RefreshTokenHasherAdapter implements RefreshTokenHasher {
  hash(token: string): string {
    return hashRefreshToken(token);
  }
}

export class CryptoTokenHasher implements TokenHasher {
  hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
  generate(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}

export class ObjectIdValidator implements IdValidator {
  isValid(id: Id): boolean {
    return Types.ObjectId.isValid(id);
  }
}

export class EventBusAdapter implements EventsPort {
  userLoggedIn(p: { userId: string; sessionId: string; ip?: string; userAgent?: string }): void {
    eventBus.emit('iam.user.logged-in', p);
  }
  userLocked(p: { userId: string; reason: string }): void {
    eventBus.emit('iam.user.locked', p);
  }
  sessionReuseDetected(p: { userId: string }): void {
    eventBus.emit('iam.session.reuse-detected', p);
  }
  sessionRevoked(p: { userId: string; sessionId: string }): void {
    eventBus.emit('iam.session.revoked', p);
  }
  passwordChanged(p: { userId: string }): void {
    eventBus.emit('iam.user.password-changed', p);
  }
}
