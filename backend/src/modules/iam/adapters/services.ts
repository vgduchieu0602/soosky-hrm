import { comparePassword, hashPassword } from '@shared/crypto/hash.util';
import type { Clock, PasswordHasher } from '@modules/iam/core/app/ports';

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
