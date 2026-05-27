import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '@shared/errors/http-error';

/**
 * Granular guard for action keys like `payroll:approve`, `user:create`.
 * Requires `authenticate` to have run first (sets req.user.permissions).
 *
 * Semantics: ALL required keys must be present (AND). For OR semantics use
 * multiple smaller route groups.
 */
export const requirePermission =
  (...required: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, 'Unauthenticated', 'IAM_002'));
    }
    const owned = new Set(req.user.permissions);
    const missing = required.filter((k) => !owned.has(k));
    if (missing.length > 0) {
      return next(new HttpError(403, `Missing permission: ${missing.join(', ')}`, 'IAM_004'));
    }
    next();
  };
