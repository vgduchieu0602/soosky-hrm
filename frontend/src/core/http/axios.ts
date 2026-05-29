import axios from "axios";
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

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (!path.startsWith("/auth/")) {
        useAuthStore.getState().logout();
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(err);
  },
);

export default api;
