/**
 * Kiểu dữ liệu module Đánh giá, khớp 1:1 contract backend `/api/v1/performance`
 * (xem share-docs/API-SPEC.md § Đánh giá hiệu suất).
 */

/** Nhóm tiêu chí — ánh xạ đúng ba con số backend tổng hợp. */
export type CriterionKind = "kpi" | "goal" | "performance";

/**
 * Vòng đời phiếu: quản lý chấm → HR duyệt → nhân viên xác nhận/khiếu nại →
 * HR khoá. `locked` bất biến và là trạng thái DUY NHẤT được chụp vào lương.
 */
export type ReviewStatus = "draft" | "submitted" | "approved" | "acknowledged" | "appealed" | "locked";

export type CycleStatus = "draft" | "active" | "closed";

export interface Criterion {
  id: string;
  code: string;
  name: string;
  kind: CriterionKind;
  /** Trọng số trong nhóm (%), tổng mỗi nhóm = 100. */
  weight: number;
}

export interface CriteriaVersion {
  version: number;
  criteria: Criterion[];
  publishedAt: string;
  publishedBy: string;
}

export interface CriteriaSet {
  id: string;
  name: string;
  description: string | null;
  versions: CriteriaVersion[];
  latestVersion: number | null;
  createdAt: string;
}

export interface AppraisalCycle {
  id: string;
  name: string;
  payrollPeriodId: string;
  criteriaSetId: string;
  /** Phiên bản tiêu chí CHỐT cho cả chu kỳ — không đổi sau khi mở. */
  criteriaVersion: number;
  status: CycleStatus;
  createdAt: string;
  activatedAt: string | null;
  closedAt: string | null;
}

export interface CriterionScore {
  criterionId: string;
  score: number;
}

export interface ReviewTotals {
  kpiScore: number;
  goalScore: number;
  performanceScore: number;
}

export interface PerformanceReview {
  id: string;
  cycleId: string;
  employeeId: string;
  reviewerUserId: string;
  criteriaSetId: string;
  /** Phiên bản tiêu chí phiếu này dùng — điểm cũ luôn đọc theo đúng bộ lúc đó. */
  criteriaVersion: number;
  scores: CriterionScore[];
  /** `null` khi chưa chấm. Backend tự tính từ trọng số, client KHÔNG gửi lên. */
  totals: ReviewTotals | null;
  status: ReviewStatus;
  managerNote: string | null;
  strengths: string | null;
  improvements: string | null;
  developmentPlan: string | null;
  appealNote: string | null;
  hrNote: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  acknowledgedAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
}

export interface CycleReadiness {
  cycleId: string;
  payrollPeriodId: string;
  cycleStatus: CycleStatus;
  totalActiveEmployees: number;
  lockedCount: number;
  /** Nhân viên chưa khoá điểm — chặn đóng chu kỳ và chặn chốt đánh giá bên lương. */
  pendingEmployeeIds: string[];
  countByStatus: Record<ReviewStatus, number>;
  ready: boolean;
}

export interface ScoreReviewInput {
  scores: CriterionScore[];
  managerNote?: string;
  strengths?: string;
  improvements?: string;
  developmentPlan?: string;
}

export interface CreateCycleInput {
  name: string;
  payrollPeriodId: string;
  criteriaSetId: string;
  /** Bỏ trống → backend chốt phiên bản mới nhất tại thời điểm tạo. */
  criteriaVersion?: number;
}

export interface PublishCriteriaVersionInput {
  criteriaSetId: string;
  criteria: {
    code: string;
    name: string;
    kind: CriterionKind;
    weight: number;
  }[];
}

export interface ListReviewsParams {
  cycleId?: string;
  employeeId?: string;
  status?: ReviewStatus;
  /** true = chỉ phiếu mà mình là người chấm (hàng việc của quản lý). */
  assignedToMe?: boolean;
}
