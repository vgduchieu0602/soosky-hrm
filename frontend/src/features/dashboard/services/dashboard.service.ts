import api from "@core/http/axios";
import type { DashboardOverview } from "@features/dashboard/types/dashboard.types";

interface Env<T> {
  data: T;
}

export const dashboardService = {
  async overview(): Promise<DashboardOverview> {
    const { data } = await api.get<Env<DashboardOverview>>("/admin/dashboard");
    return data.data;
  },
};
