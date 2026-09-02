import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Employee } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import { HttpError } from '@shared/errors/http-error';

const HR_ROLES = ['admin', 'hr_manager'];

/**
 * Authorizes a request on an employee-scoped route (`/employees/:id/...`):
 * HR/Admin pass through; any other user may only act on their OWN employee
 * record (resolved via `userId`). Blocks horizontal privilege escalation
 * (IDOR) where any authenticated employee could read/write another's data.
 *
 * `paramName` is the route param holding the target employee id (default `id`).
 */
export const selfOrHr =
  (paramName = 'id') =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new HttpError(401, 'Unauthenticated', 'IAM_002'));
      }

      if (req.user.roles.some((r) => HR_ROLES.includes(r))) {
        return next();
      }

      const targetId = (req.params as Record<string, string>)[paramName];
      if (!targetId || !Types.ObjectId.isValid(targetId)) {
        return next(new HttpError(403, 'Forbidden', 'IAM_004'));
      }

      const own = await Employee.findOne({ userId: req.user.userId })
        .select('_id')
        .lean();

      if (!own || String(own._id) !== String(targetId)) {
        return next(new HttpError(403, 'Forbidden', 'IAM_004'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
