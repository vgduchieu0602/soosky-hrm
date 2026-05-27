export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'SYS_001',
  ) {
    super(message);
  }
}
