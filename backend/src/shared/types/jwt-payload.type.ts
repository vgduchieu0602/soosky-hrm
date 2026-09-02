import type { JwtPayload } from 'jsonwebtoken';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  mustChangePassword?: boolean;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  sessionId: string;
  tokenVersion: number;
}
