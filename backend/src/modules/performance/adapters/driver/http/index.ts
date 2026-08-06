import AppraisalCycleController, { AppraisalCycleControllerUseCases } from "@modules/performance/adapters/driver/http/controllers/AppraisalCycleController";
import CriteriaController, { CriteriaControllerUseCases } from "@modules/performance/adapters/driver/http/controllers/CriteriaController";
import PerformanceReviewController, { PerformanceReviewControllerUseCases } from "@modules/performance/adapters/driver/http/controllers/PerformanceReviewController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/** Toàn bộ use-case mà driver adapter HTTP của module Performance cần. */
export type PerformanceHttpUseCases =
    & CriteriaControllerUseCases
    & AppraisalCycleControllerUseCases
    & PerformanceReviewControllerUseCases;

/**
 * Driver adapter HTTP của module Performance. Giữ danh sách route duy nhất —
 * nhìn một chỗ thấy toàn bộ bề mặt API.
 *
 * Mọi endpoint đều cần Bearer token; phân quyền chi tiết nằm trong use-case
 * (`performance:manage` cho quản trị, `performance:review*` cho chấm,
 * `performance:read*` cho xem) chứ không ở đây.
 */
export function createPerformanceHttpRouter(
    useCases: PerformanceHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const criteriaController = new CriteriaController(useCases);
    const cycleController    = new AppraisalCycleController(useCases);
    const reviewController   = new PerformanceReviewController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    // Bộ tiêu chí — sửa tiêu chí = phát hành PHIÊN BẢN mới, không sửa bản cũ.
    router.post("/criteria-sets",                          criteriaController.createCriteriaSet);
    router.get ("/criteria-sets",                          criteriaController.listCriteriaSets);
    router.post("/criteria-sets/:criteriaSetId/versions",  criteriaController.publishCriteriaVersion);

    // Chu kỳ đánh giá
    router.post("/cycles",                       cycleController.createCycle);
    router.get ("/cycles",                       cycleController.listCycles);
    router.post("/cycles/:cycleId/activate",     cycleController.activateCycle);
    router.get ("/cycles/:cycleId/readiness",    cycleController.getReadiness);
    router.post("/cycles/:cycleId/close",        cycleController.closeCycle);

    // Phiếu đánh giá: chấm (quản lý) → duyệt (HR) → xác nhận/khiếu nại (nhân viên) → khoá (HR)
    router.get ("/reviews",                          reviewController.listReviews);
    router.get ("/reviews/:reviewId",                reviewController.getReview);
    router.put ("/reviews/:reviewId/scores",         reviewController.scoreReview);
    router.post("/reviews/:reviewId/approve",        reviewController.approveReview);
    router.post("/reviews/:reviewId/request-changes", reviewController.requestChanges);
    router.post("/reviews/:reviewId/acknowledge",    reviewController.acknowledgeReview);
    router.post("/reviews/:reviewId/appeal",         reviewController.appealReview);
    router.post("/reviews/:reviewId/resolve-appeal", reviewController.resolveAppeal);
    router.post("/reviews/:reviewId/lock",           reviewController.lockReview);
    router.patch("/reviews/:reviewId/reviewer",      reviewController.assignReviewer);

    router.use(errorHandler);

    return router;
}
