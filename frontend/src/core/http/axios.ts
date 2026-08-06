import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@core/store/auth.store";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function forceLogout() {
  useAuthStore.getState().logout();
  if (!window.location.pathname.startsWith("/auth/")) {
    window.location.href = "/auth/login";
  }
}

// Single-flight refresh: concurrent 401s share one /auth/refresh call and
// retry once it resolves, instead of each triggering its own logout.
let refreshing: Promise<string> | null = null;

function refreshToken(): Promise<string> {
  if (!refreshing) {
    refreshing = axios
      .post<{ accessToken: string; refreshToken: string }>(
        "/auth/sessions/refresh",
        { refreshToken: useAuthStore.getState().refreshToken },
        { baseURL: api.defaults.baseURL, withCredentials: true },
      )
      .then((res) => {
        const token = res.data.accessToken;
        useAuthStore.getState().setSessionTokens(token, res.data.refreshToken);
        return token;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    const status = err.response?.status;
    const url = original?.url ?? "";

    // Don't try to refresh the refresh/login calls themselves, or when we've
    // already retried this request once.
    const isAuthCall =
      url.includes("/auth/sessions/refresh") || url.includes("/auth/sessions");

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const token = await refreshToken();
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original as AxiosRequestConfig);
      } catch {
        forceLogout();
        return Promise.reject(err);
      }
    }

    if (status === 401 && !isAuthCall) {
      forceLogout();
    }

    // Server enforces a forced password change — route the user to the
    // change-password page instead of surfacing a generic error.
    // Envelope loi cua backend la `{ code, message }` o cap cao nhat.
    const body = err.response?.data as { code?: string; error?: { code?: string } } | undefined;
    const code = body?.code ?? body?.error?.code;
    if (status === 403 && code === "PASSWORD_CHANGE_REQUIRED") {
      if (!window.location.pathname.startsWith("/auth/")) {
        window.location.href = "/auth/change-password";
      }
    }

    return Promise.reject(err);
  },
);

export default api;
