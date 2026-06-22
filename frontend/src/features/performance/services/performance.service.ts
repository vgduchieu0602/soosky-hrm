import api from "@core/http/axios";
import type { DirectEvaluateInput, Evaluation } from "@features/performance/types/performance.types";

interface Env<T> {
  data: T;
}

export const performanceService = {
  async list(payrollPeriodId?: string): Promise<Evaluation[]> {
    const { data } = await api.get<Env<Evaluation[]>>("/performance/evaluations", {
      params: payrollPeriodId ? { payrollPeriodId } : undefined,
    });
    return data.data ?? [];
  },
  /** HR: one employee's evaluations across all periods (history). */
  async byEmployee(employeeId: string): Promise<Evaluation[]> {
    const { data } = await api.get<Env<Evaluation[]>>(`/performance/evaluations/employee/${employeeId}`);
    return data.data ?? [];
  },
  async mine(): Promise<Evaluation[]> {
    const { data } = await api.get<Env<Evaluation[]>>("/performance/evaluations/me");
    return data.data ?? [];
  },
  /** Direct evaluate: upsert + draft (finalize=false) or approve (finalize=true). */
  async evaluate(input: DirectEvaluateInput): Promise<Evaluation> {
    const { data } = await api.post<Env<Evaluation>>("/performance/evaluations", input);
    return data.data;
  },
  async acknowledge(id: string, disputeNote?: string): Promise<Evaluation> {
    const { data } = await api.post<Env<Evaluation>>(`/performance/evaluations/${id}/acknowledge`, {
      ...(disputeNote ? { disputeNote } : {}),
    });
    return data.data;
  },
  async reopen(id: string): Promise<Evaluation> {
    const { data } = await api.post<Env<Evaluation>>(`/performance/evaluations/${id}/reopen`);
    return data.data;
  },
};
