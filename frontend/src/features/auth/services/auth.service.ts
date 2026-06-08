import api from "@core/http/axios";
import type {
  ApiEnvelope,
  AuthUser,
  LoginRequest,
  LoginResponse,
} from "@features/auth/types/auth.types";

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const { data } = await api.post<ApiEnvelope<LoginResponse>>(
      "/auth/login",
      payload,
    );
    return data.data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<ApiEnvelope<AuthUser>>("/auth/me");
    return data.data;
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout");
  },

  async refresh(): Promise<{ accessToken: string }> {
    const { data } = await api.post<ApiEnvelope<{ accessToken: string }>>(
      "/auth/refresh",
    );
    return data.data;
  },

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await api.patch("/auth/change-password", payload);
  },
};
