import { HttpError } from '@shared/errors/http-error';

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', code = 'IAM_004') {
    super(403, message, code);
  }
}
