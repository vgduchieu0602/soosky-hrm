import api from "@core/http/axios";

export type Bank = {
  _id: string;
  name: string;
  code?: string;
  status: "active" | "archived";
};

interface Env<T> { data: T }

export const bankService = {
  async list(): Promise<Bank[]> {
    const { data } = await api.get<Env<Bank[]>>("/settings/banks");
    return data.data ?? [];
  },
  async create(input: { name: string; code?: string }): Promise<Bank> {
    const { data } = await api.post<Env<Bank>>("/admin/settings/banks", input);
    return data.data;
  },
  async update(id: string, input: Partial<Pick<Bank, "name" | "code" | "status">>): Promise<Bank> {
    const { data } = await api.patch<Env<Bank>>(`/admin/settings/banks/${id}`, input);
    return data.data;
  },
  async archive(id: string): Promise<void> {
    await api.delete(`/admin/settings/banks/${id}`);
  },
};
