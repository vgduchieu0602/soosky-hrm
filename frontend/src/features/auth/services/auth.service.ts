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

  /**
   * Đổi mật khẩu. Máy chủ trả kèm access token MỚI (đã bỏ cờ
   * `mustChangePassword`) cho đúng phiên hiện tại — dùng ngay, khỏi phải refresh.
   */
  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ ok: boolean; accessToken?: string }> {
    const { data } = await api.patch<ApiEnvelope<{ ok: boolean; accessToken?: string }>>(
      "/auth/change-password",
      payload,
    );
    return data.data;
  },

  /** Validate a set-password / reset link token before showing the form. */
  async checkSetupToken(
    token: string,
  ): Promise<{ purpose: "setup" | "reset"; username: string; email: string }> {
    const { data } = await api.get<
      ApiEnvelope<{ purpose: "setup" | "reset"; username: string; email: string }>
    >("/auth/set-password", { params: { token } });
    return data.data;
  },

  /** Set a new password using a single-use token from the email link. */
  async setPassword(payload: { token: string; password: string }): Promise<void> {
    await api.post("/auth/set-password", payload);
  },
};
