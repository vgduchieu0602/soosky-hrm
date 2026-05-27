export interface AuthPayload {
  userId: string;
  roles: string[];
  permissions: string[];
  mustChangePassword?: boolean;
  sessionId?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPayload;
  }
}
