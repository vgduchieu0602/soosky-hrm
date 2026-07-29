import DepartmentController, { DepartmentControllerUseCases } from "@modules/department/adapters/driver/http/controllers/DepartmentController";
import PositionController, { PositionControllerUseCases } from "@modules/department/adapters/driver/http/controllers/PositionController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/**
 * Toàn bộ use-case mà driver adapter HTTP của module Department cần.
 */
export type DepartmentHttpUseCases =
    & DepartmentControllerUseCases
    & PositionControllerUseCases;

/**
 * Driver adapter HTTP của module Department. Giữ danh sách route duy nhất —
 * nhìn một chỗ thấy toàn bộ bề mặt API: parse JSON body, xác thực Bearer
 * token, định tuyến tới controller, dịch lỗi thành `{ code, message }`.
 */
export function createDepartmentHttpRouter(
    useCases: DepartmentHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const departmentController = new DepartmentController(useCases);
    const positionController   = new PositionController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    // Department
    router.post  ("/departments",                       departmentController.createDepartment);
    router.get   ("/departments",                       departmentController.listDepartments);
    router.get   ("/departments/:departmentId",         departmentController.getDepartment);
    router.patch ("/departments/:departmentId",         departmentController.updateDepartment);
    router.patch ("/departments/:departmentId/parent",  departmentController.reparentDepartment);
    router.patch ("/departments/:departmentId/head",    departmentController.assignDepartmentHead);
    router.post  ("/departments/:departmentId/archive", departmentController.archiveDepartment);
    router.delete("/departments/:departmentId",         departmentController.deleteDepartment);

    // Position
    router.post  ("/positions",                         positionController.createPosition);
    router.get   ("/positions",                         positionController.listPositions);
    router.get   ("/positions/:positionId",             positionController.getPosition);
    router.patch ("/positions/:positionId",             positionController.updatePosition);
    router.post  ("/positions/:positionId/archive",     positionController.archivePosition);
    router.delete("/positions/:positionId",             positionController.deletePosition);

    router.use(errorHandler);

    return router;
}
