import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@core/http/axios", () => ({ default: api }));

import { performanceService } from "@features/performance/services/performance.service";

describe("performanceService — bộ tiêu chí", () => {
  beforeEach(() => vi.resetAllMocks());

  it("doc danh sach bo tieu chi", async () => {
    api.get.mockResolvedValueOnce({
      data: { criteriaSets: [{ id: "set-1", name: "KPI 2026", description: "", latestVersion: 2, versions: [] }] },
    });

    await expect(performanceService.criteriaSets()).resolves.toMatchObject([{ id: "set-1", latestVersion: 2 }]);
    expect(api.get).toHaveBeenCalledWith("/performance/criteria-sets");
  });

  it("sua tieu chi = PHAT HANH ban moi, khong PATCH ban cu", async () => {
    api.post.mockResolvedValueOnce({ data: { criteriaSetId: "set-1", version: 3 } });

    const criteria = [{ code: "quality", name: "Chất lượng", kind: "performance" as const, weight: 60 }];
    await expect(performanceService.publishCriteriaVersion({ criteriaSetId: "set-1", criteria }))
      .resolves.toEqual({ criteriaSetId: "set-1", version: 3 });

    expect(api.post).toHaveBeenCalledWith("/performance/criteria-sets/set-1/versions", { criteria });
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });
});

describe("performanceService — chu kỳ đánh giá", () => {
  beforeEach(() => vi.resetAllMocks());

  it("tao chu ky gui nguyen payload (gom payrollPeriodId)", async () => {
    api.post.mockResolvedValueOnce({ data: { cycleId: "cycle-1", criteriaVersion: 2 } });

    const input = { name: "2026-11", payrollPeriodId: "period-1", criteriaSetId: "set-1" };
    await expect(performanceService.createCycle(input)).resolves.toEqual({ cycleId: "cycle-1", criteriaVersion: 2 });
    expect(api.post).toHaveBeenCalledWith("/performance/cycles", input);
  });

  it("mo chu ky: khong co fallback reviewer thi gui body rong, khong gui undefined", async () => {
    api.post.mockResolvedValueOnce({ data: { assigned: 20, withoutManager: [] } });

    await performanceService.activateCycle("cycle-1");
    expect(api.post).toHaveBeenCalledWith("/performance/cycles/cycle-1/activate", {});
  });

  it("mo chu ky kem fallback reviewer thi gui truong do", async () => {
    api.post.mockResolvedValueOnce({ data: { assigned: 20, withoutManager: ["emp-9"] } });

    await expect(performanceService.activateCycle("cycle-1", "user-hr"))
      .resolves.toMatchObject({ withoutManager: ["emp-9"] });
    expect(api.post).toHaveBeenCalledWith("/performance/cycles/cycle-1/activate", { fallbackReviewerUserId: "user-hr" });
  });

  it("readiness va close dung route cua chu ky", async () => {
    api.get.mockResolvedValueOnce({ data: { cycleId: "cycle-1", total: 20, locked: 18, pendingEmployeeIds: ["emp-1", "emp-2"] } });
    api.post.mockResolvedValueOnce({ data: undefined });

    await expect(performanceService.cycleReadiness("cycle-1")).resolves.toMatchObject({ locked: 18 });
    await performanceService.closeCycle("cycle-1");

    expect(api.get).toHaveBeenCalledWith("/performance/cycles/cycle-1/readiness");
    expect(api.post).toHaveBeenCalledWith("/performance/cycles/cycle-1/close");
  });
});

describe("performanceService — phiếu đánh giá", () => {
  beforeEach(() => vi.resetAllMocks());

  it("list phieu: chi gui tham so co gia tri; assignedToMe thanh chuoi 'true'", async () => {
    api.get.mockResolvedValue({ data: { reviews: [] } });

    await performanceService.reviews({ cycleId: "cycle-1", assignedToMe: true });
    expect(api.get).toHaveBeenCalledWith("/performance/reviews", {
      params: { cycleId: "cycle-1", assignedToMe: "true" },
    });

    await performanceService.reviews({ status: "submitted" });
    expect(api.get).toHaveBeenLastCalledWith("/performance/reviews", { params: { status: "submitted" } });
  });

  it("phieu cua chinh minh: KHONG gui employeeId, backend thu hep theo pham vi self", async () => {
    api.get.mockResolvedValueOnce({ data: { reviews: [{ id: "review-1", employeeId: "emp-1" }] } });

    await expect(performanceService.myReviews()).resolves.toMatchObject([{ id: "review-1" }]);
    expect(api.get).toHaveBeenCalledWith("/performance/reviews", { params: {} });
  });

  it("cham diem dung PUT /scores; client khong gui diem tong hop", async () => {
    api.put.mockResolvedValueOnce({ data: { reviewId: "review-1", totals: { kpiScore: 85, goalScore: 90, performanceScore: 88 } } });

    const input = { scores: [{ criterionId: "criterion-1", score: 9 }] };
    await expect(performanceService.score("review-1", input))
      .resolves.toMatchObject({ totals: { performanceScore: 88 } });

    expect(api.put).toHaveBeenCalledWith("/performance/reviews/review-1/scores", input);
    const [, body] = api.put.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).not.toHaveProperty("performanceScore");
    expect(body).not.toHaveProperty("goalScore");
  });

  it("duyet/yeu cau sua/xac nhan/khieu nai dung method va payload", async () => {
    api.post.mockResolvedValue({ data: undefined });

    await performanceService.approve("review-1");
    expect(api.post).toHaveBeenCalledWith("/performance/reviews/review-1/approve", {});

    await performanceService.approve("review-1", "OK");
    expect(api.post).toHaveBeenLastCalledWith("/performance/reviews/review-1/approve", { hrNote: "OK" });

    await performanceService.requestChanges("review-1", "Thiếu nhận xét");
    expect(api.post).toHaveBeenLastCalledWith("/performance/reviews/review-1/request-changes", { hrNote: "Thiếu nhận xét" });

    await performanceService.acknowledge("review-1");
    expect(api.post).toHaveBeenLastCalledWith("/performance/reviews/review-1/acknowledge");

    await performanceService.appeal("review-1", "Điểm chưa đúng");
    expect(api.post).toHaveBeenLastCalledWith("/performance/reviews/review-1/appeal", { reason: "Điểm chưa đúng" });

    await performanceService.resolveAppeal("review-1", "Đã rà lại", true);
    expect(api.post).toHaveBeenLastCalledWith("/performance/reviews/review-1/resolve-appeal", { hrNote: "Đã rà lại", rescore: true });
  });

  it("khoa diem tra ve totals da chup sang ky luong", async () => {
    api.post.mockResolvedValueOnce({ data: { reviewId: "review-1", totals: { kpiScore: 85, goalScore: 90, performanceScore: 88 } } });

    await expect(performanceService.lock("review-1"))
      .resolves.toEqual({ reviewId: "review-1", totals: { kpiScore: 85, goalScore: 90, performanceScore: 88 } });
    expect(api.post).toHaveBeenCalledWith("/performance/reviews/review-1/lock");
  });

  it("doi nguoi cham dung PATCH /reviewer", async () => {
    api.patch.mockResolvedValueOnce({ data: undefined });

    await performanceService.assignReviewer("review-1", "user-manager");
    expect(api.patch).toHaveBeenCalledWith("/performance/reviews/review-1/reviewer", { reviewerUserId: "user-manager" });
  });

  it("loi nghiep vu (403 tu choi tu cham, 409 sai trang thai) duoc nem nguyen ra ngoai", async () => {
    api.put.mockRejectedValueOnce(Object.assign(new Error("Request failed"), {
      response: { status: 403, data: { code: "ACCESS_DENIED", message: "Không được tự chấm điểm cho bản thân" } },
    }));
    await expect(performanceService.score("review-1", { scores: [] }))
      .rejects.toMatchObject({ response: { data: { code: "ACCESS_DENIED" } } });

    api.post.mockRejectedValueOnce(Object.assign(new Error("Request failed"), {
      response: { status: 409, data: { code: "APPRAISAL_REVIEW_STATE_INVALID", message: "Phiếu đã khoá" } },
    }));
    await expect(performanceService.lock("review-1"))
      .rejects.toMatchObject({ response: { data: { code: "APPRAISAL_REVIEW_STATE_INVALID" } } });
  });
});
