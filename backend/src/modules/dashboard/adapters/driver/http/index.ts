import DashboardController, { DashboardControllerUseCases } from "@modules/dashboard/adapters/driver/http/controllers/DashboardController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/** Toàn bộ use-case mà driver adapter HTTP của module Dashboard cần. */
export type DashboardHttpUseCases = DashboardControllerUseCases;

/**
 * Driver adapter HTTP của module Dashboard — MỘT route đọc duy nhất.
 *
 * Không có endpoint theo từng ô số: nếu tách nhỏ thì frontend lại ghép, và phạm
 * vi quyền lại nằm rải rác ở từng endpoint như trước.
 */
export function createDashboardHttpRouter(
    useCases: DashboardHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const dashboardController = new DashboardController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    router.get("/overview", dashboardController.getOverview);

    router.use(errorHandler);

    return router;
}
