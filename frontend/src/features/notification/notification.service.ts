import api from "@core/http/axios";

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export interface NotificationItem {
  _id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  readAt?: string | null;
  created_at: string;
}

interface Env<T> { data: T }

export const notificationService = {
  async list(opts: { unread?: boolean; limit?: number } = {}): Promise<NotificationItem[]> {
    const sp = new URLSearchParams();
    if (opts.unread) sp.set("unread", "true");
    if (opts.limit) sp.set("limit", String(opts.limit));
    const qs = sp.toString();
    const { data } = await api.get<Env<NotificationItem[]>>(`/notifications${qs ? `?${qs}` : ""}`);
    return data.data ?? [];
  },
  async unreadCount(): Promise<number> {
    const { data } = await api.get<Env<{ count: number }>>("/notifications/unread-count");
    return data.data?.count ?? 0;
  },
  async markRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await api.post("/notifications/read-all");
  },
};
