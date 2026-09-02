import { generateRandomPassword } from '@modules/iam/core/domain/password-generator';
import type { PasswordHasher } from '@modules/iam/core/app/ports';

/**
 * Credentials are IAM's concern: what a stored secret is made of and how it is
 * hashed lives here, behind the `PasswordHasher` port. Callers outside IAM ask
 * for a credential and never see the algorithm or the plaintext.
 */
export class CredentialUseCases {
  constructor(private readonly hasher: PasswordHasher) {}

  /**
   * A stored credential nobody knows — the plaintext is discarded here and
   * never leaves this method.
   *
   * `users.password` is required, but a freshly provisioned employee account is
   * not meant to be logged into with a password HR picked: the employee sets
   * their own through the single-use link emailed to them. Seeding the row with
   * an unguessable secret keeps the account unusable until they do.
   */
  unusable(): Promise<string> {
    return this.hasher.hash(generateRandomPassword(24));
  }
}
