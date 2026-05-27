import type {Request, Response, NextFunction} from 'express'
import {HttpError} from '@shared/errors/http-error'

export const requireRoles = (...allowed: string[]) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return next(new HttpError(401, 'Unauthenticated', 'IAM_002'))
    }

    const ok = req.user.roles.some((r) => allowed.includes(r))

    if (!ok) {
        return next(new HttpError(403, 'Insufficient role', 'IAM_004'))
    }

    next()
}