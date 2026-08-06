import api from "@core/http/axios";
import type {
  AppraisalCycle,
  CreateCycleInput,
  CriteriaSet,
  CycleReadiness,
  ListReviewsParams,
  PerformanceReview,
  PublishCriteriaVersionInput,
  ReviewTotals,
  ScoreReviewInput,
} from "@features/performance/types/performance.types";

/**
 * Module Đánh giá — gọi thẳng backend `/performance`, không có envelope `{ data }`
 * (quy ước chung của API: response trả DTO hoặc object theo controller).
 *
 * Phân quyền do BACKEND enforce; các hàm dưới đây chỉ là bề mặt gọi API. Giao
 * diện ẩn nút theo vai chỉ để người dùng đỡ bấm vào chỗ sẽ bị từ chối.
 */
export const performanceService = {
  // ---- bộ tiêu chí (có phiên bản) ----
  async criteriaSets(): Promise<CriteriaSet[]> {
    const { data } = await api.get<{ criteriaSets: CriteriaSet[] }>("/performance/criteria-sets");
    return data.criteriaSets;
  },

  async createCriteriaSet(input: { name: string; description?: string }): Promise<{ criteriaSetId: string }> {
    const { data } = await api.post<{ criteriaSetId: string }>("/performance/criteria-sets", input);
    return data;
  },

  /**
   * Sửa tiêu chí = phát hành PHIÊN BẢN mới. Không có endpoint sửa bản cũ: phiếu
   * đã chấm giữ số phiên bản của nó, nên lịch sử không bao giờ đổi nghĩa.
   */
  async publishCriteriaVersion(input: PublishCriteriaVersionInput): Promise<{ criteriaSetId: string; version: number }> {
    const { criteriaSetId, criteria } = input;
    const { data } = await api.post<{ criteriaSetId: string; version: number }>(
      `/performance/criteria-sets/${criteriaSetId}/versions`,
      { criteria },
    );
    return data;
  },

  // ---- chu kỳ đánh giá ----
  async cycles(): Promise<AppraisalCycle[]> {
    const { data } = await api.get<{ cycles: AppraisalCycle[] }>("/performance/cycles");
    return data.cycles;
  },

  async createCycle(input: CreateCycleInput): Promise<{ cycleId: string; criteriaVersion: number }> {
    const { data } = await api.post<{ cycleId: string; criteriaVersion: number }>("/performance/cycles", input);
    return data;
  },

  /** Mở chu kỳ: backend tự phân công người chấm theo chuỗi quản lý trực tiếp. */
  async activateCycle(cycleId: string, fallbackReviewerUserId?: string): Promise<{ assigned: number; withoutManager: string[] }> {
    const { data } = await api.post<{ assigned: number; withoutManager: string[] }>(
      `/performance/cycles/${cycleId}/activate`,
      fallbackReviewerUserId != null ? { fallbackReviewerUserId } : {},
    );
    return data;
  },

  async cycleReadiness(cycleId: string): Promise<CycleReadiness> {
    const { data } = await api.get<CycleReadiness>(`/performance/cycles/${cycleId}/readiness`);
    return data;
  },

  async closeCycle(cycleId: string): Promise<void> {
    await api.post(`/performance/cycles/${cycleId}/close`);
  },

  // ---- phiếu đánh giá ----
  async reviews(params: ListReviewsParams = {}): Promise<PerformanceReview[]> {
    const { data } = await api.get<{ reviews: PerformanceReview[] }>("/performance/reviews", {
      params: {
        ...(params.cycleId != null ? { cycleId: params.cycleId } : {}),
        ...(params.employeeId != null ? { employeeId: params.employeeId } : {}),
        ...(params.status != null ? { status: params.status } : {}),
        ...(params.assignedToMe === true ? { assignedToMe: "true" } : {}),
      },
    });
    return data.reviews;
  },

  /**
   * Phiếu của CHÍNH MÌNH: không truyền employeeId, backend tự thu hẹp theo phạm
   * vi `performance:read:self`.
   */
  async myReviews(): Promise<PerformanceReview[]> {
    return performanceService.reviews();
  },

  async review(reviewId: string): Promise<PerformanceReview> {
    const { data } = await api.get<PerformanceReview>(`/performance/reviews/${reviewId}`);
    return data;
  },

  /** Quản lý/HR chấm điểm. Điểm tổng hợp do backend tính, client không gửi lên. */
  async score(reviewId: string, input: ScoreReviewInput): Promise<{ reviewId: string; totals: ReviewTotals }> {
    const { data } = await api.put<{ reviewId: string; totals: ReviewTotals }>(
      `/performance/reviews/${reviewId}/scores`,
      input,
    );
    return data;
  },

  async approve(reviewId: string, hrNote?: string): Promise<void> {
    await api.post(`/performance/reviews/${reviewId}/approve`, hrNote != null ? { hrNote } : {});
  },

  async requestChanges(reviewId: string, hrNote: string): Promise<void> {
    await api.post(`/performance/reviews/${reviewId}/request-changes`, { hrNote });
  },

  /** Nhân viên xác nhận phiếu của chính mình — HR không bấm thay được. */
  async acknowledge(reviewId: string): Promise<void> {
    await api.post(`/performance/reviews/${reviewId}/acknowledge`);
  },

  async appeal(reviewId: string, reason: string): Promise<void> {
    await api.post(`/performance/reviews/${reviewId}/appeal`, { reason });
  },

  async resolveAppeal(reviewId: string, hrNote: string, rescore: boolean): Promise<void> {
    await api.post(`/performance/reviews/${reviewId}/resolve-appeal`, { hrNote, rescore });
  },

  /** HR khoá điểm → backend chụp điểm sang kỳ lương. Sau đó phiếu bất biến. */
  async lock(reviewId: string): Promise<{ reviewId: string; totals: ReviewTotals }> {
    const { data } = await api.post<{ reviewId: string; totals: ReviewTotals }>(`/performance/reviews/${reviewId}/lock`);
    return data;
  },

  async assignReviewer(reviewId: string, reviewerUserId: string): Promise<void> {
    await api.patch(`/performance/reviews/${reviewId}/reviewer`, { reviewerUserId });
  },
};
