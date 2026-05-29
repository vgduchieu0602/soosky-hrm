export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ApiEnvelope<T> {
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code?: string;
    message: string;
  };
}
