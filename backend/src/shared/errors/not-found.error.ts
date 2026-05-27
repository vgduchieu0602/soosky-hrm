import { HttpError } from '@shared/errors/http-error';

export class NotFoundError extends HttpError {
  constructor(resource: string, code = 'SYS_404') {
    super(404, `${resource} not found`, code);
  }
}
