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
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Những endpoint KHÔNG bao giờ được kích hoạt luồng refresh.
 *
 * `/auth/refresh` tự gọi lại chính nó là đệ quy vô hạn; `/auth/login` trả 401
 * khi sai mật khẩu — refresh ở đây chỉ làm nhiễu và nuốt mất thông báo lỗi.
 */
function isRefreshExempt(url: string): boolean {
  return url.includes("/auth/refresh") || url.includes("/auth/login");
}

// Refresh gộp: nhiều request cùng nhận 401 sẽ dùng CHUNG một lời gọi
// `/auth/refresh` rồi thử lại, thay vì mỗi request tự refresh một lần.
let refreshing: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshing ??= axios
    .post<{ data: { accessToken: string } }>("/auth/refresh", undefined, {
      baseURL: api.defaults.baseURL,
      withCredentials: true,
    })
    .then((res) => {
      const token = res.data.data.accessToken;
      useAuthStore.getState().setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshing = null;
    });

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

    if (status !== 401 || !original || isRefreshExempt(url)) {
      return Promise.reject(err);
    }

    // Mỗi request chỉ được thử lại ĐÚNG một lần sau khi refresh.
    if (original._retry) {
      useAuthStore.getState().markUnauthenticated();
      return Promise.reject(err);
    }

    original._retry = true;
    try {
      const token = await refreshAccessToken();
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${token}`;
      return await api(original as AxiosRequestConfig);
    } catch {
      // Không dùng `window.location` để điều hướng: axios là tầng hạ tầng, ép
      // tải lại trang ở đây sẽ mất trạng thái ứng dụng và gây chớp màn hình.
      // Chỉ đánh dấu mất phiên — `ProtectedRoute` phản ứng và chuyển trang.
      useAuthStore.getState().markUnauthenticated();
      return Promise.reject(err);
    }
  },
);

export default api;
