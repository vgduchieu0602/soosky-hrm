import { env } from '@config/env';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import type { SetupTokenPurpose } from '@shared/models/password-setup-token.model';
import { SETUP_TOKEN_TTL_MS, buildSetPasswordUrl as buildUrl } from '@features/iam/domain/policy';
import type {
  PasswordSetupTokenRepository,
  UserRepository,
  SessionRepository,
  PasswordHasher,
  TokenHasher,
  AuditPort,
  EventsPort,
  Clock,
  IdValidator,
} from '@features/iam/domain/ports';

const log = logger.child({ feature: 'iam', module: 'password-setup' });

/** Build the web link the recipient clicks to land on the set-password page. */
export function buildSetPasswordUrl(rawToken: string): string {
  return buildUrl(env.APP_WEB_URL, rawToken);
}

export class PasswordSetupUseCases {
  constructor(
    private readonly tokens: PasswordSetupTokenRepository,
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokenHasher: TokenHasher,
    private readonly audit: AuditPort,
    private readonly events: EventsPort,
    private readonly clock: Clock,
    private readonly ids: IdValidator,
  ) {}

  /**
   * Issue a single-use password setup/reset token for a user. Any outstanding
   * tokens for that user are invalidated so only the newest link works.
   * Returns the RAW token — store nothing but its hash; the raw value only
   * travels inside the emailed link.
   */
  async issue(userId: string, purpose: SetupTokenPurpose): Promise<string> {
    if (!this.ids.isValid(userId)) {
      throw new HttpError(400, 'Invalid user id', 'IAM_002');
    }

    // One active link at a time.
    await this.tokens.deleteActiveForUser(userId);

    const rawToken = this.tokenHasher.generate();
    const expiresAt = new Date(this.clock.now().getTime() + SETUP_TOKEN_TTL_MS[purpose]);

    await this.tokens.create({
      userId,
      tokenHash: this.tokenHasher.hash(rawToken),
      purpose,
      expiresAt,
    });

    return rawToken;
  }

  /**
   * Validate a raw token without consuming it (used by the FE to render the
   * correct page state before the user submits). Throws on invalid/expired.
   */
  async check(rawToken: string) {
    const record = await this.tokens.findActiveByHash(this.tokenHasher.hash(rawToken));
    if (!record || record.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new HttpError(400, 'Liên kết không hợp lệ hoặc đã hết hạn', 'IAM_011');
    }
    const user = await this.users.findPublicById(record.userId);
    if (!user) throw new HttpError(404, 'Tài khoản không tồn tại', 'IAM_002');

    return { purpose: record.purpose, username: user.username, email: user.email };
  }

  /**
   * Consume a token and set the new password. Single-use: the token is marked
   * used and all other outstanding tokens for the user are dropped.
   */
  async consume(rawToken: string, newPassword: string) {
    const tokenHash = this.tokenHasher.hash(rawToken);
    const record = await this.tokens.findActiveByHash(tokenHash);
    if (!record || record.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new HttpError(400, 'Liên kết không hợp lệ hoặc đã hết hạn', 'IAM_011');
    }

    const userId = await this.users.setPasswordViaToken(record.userId, await this.hasher.hash(newPassword));
    if (!userId) throw new HttpError(404, 'Tài khoản không tồn tại', 'IAM_002');

    // Mark used + invalidate any sibling tokens.
    await this.tokens.markUsedAndClearSiblings(tokenHash, userId);
    // A password (re)set must kill any pre-existing sessions — e.g. an attacker
    // holding a live refresh token after the legitimate user resets.
    await this.sessions.revokeAllForUser(userId);

    await this.audit.record({
      userId,
      resource: 'user',
      action: 'update',
      resourceId: userId,
      changes: { passwordSet: true, via: record.purpose },
    });

    this.events.passwordChanged({ userId });
    log.info({ userId, purpose: record.purpose }, 'password set via token');

    return { userId };
  }
}
