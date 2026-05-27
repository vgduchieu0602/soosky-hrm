import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'
import { HttpError } from '@shared/errors/http-error'

type Source = 'body' | 'query' | 'params'

export const validate = (schema: ZodSchema, source: Source = 'body') => (
    req: Request, 
    _res: Response, 
    next: NextFunction
) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
        return next(new HttpError(422, 'Validation Error', 'SYS_002'));
    }
    
    // Gán dữ liệu đã validate vào request object
    (req as unknown as Record<string, unknown>)[source] = result.data;
    
    next();
}