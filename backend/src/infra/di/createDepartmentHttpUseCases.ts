import { MongoDepartmentRepo, MongoPositionRepo } from "@modules/department/adapters/driven/persistence/mongodb";
import { DepartmentHttpUseCases } from "@modules/department/adapters/driver/http";
import ArchiveDepartmentUseCase from "@modules/department/core/app/use-cases/department/ArchiveDepartmentUseCase";
import AssignDepartmentHeadUseCase from "@modules/department/core/app/use-cases/department/AssignDepartmentHeadUseCase";
import CreateDepartmentUseCase from "@modules/department/core/app/use-cases/department/CreateDepartmentUseCase";
import DeleteDepartmentUseCase from "@modules/department/core/app/use-cases/department/DeleteDepartmentUseCase";
import GetDepartmentUseCase from "@modules/department/core/app/use-cases/department/GetDepartmentUseCase";
import ListDepartmentsUseCase from "@modules/department/core/app/use-cases/department/ListDepartmentsUseCase";
import ReparentDepartmentUseCase from "@modules/department/core/app/use-cases/department/ReparentDepartmentUseCase";
import UpdateDepartmentUseCase from "@modules/department/core/app/use-cases/department/UpdateDepartmentUseCase";
import ArchivePositionUseCase from "@modules/department/core/app/use-cases/position/ArchivePositionUseCase";
import CreatePositionUseCase from "@modules/department/core/app/use-cases/position/CreatePositionUseCase";
import DeletePositionUseCase from "@modules/department/core/app/use-cases/position/DeletePositionUseCase";
import GetPositionUseCase from "@modules/department/core/app/use-cases/position/GetPositionUseCase";
import ListPositionsUseCase from "@modules/department/core/app/use-cases/position/ListPositionsUseCase";
import UpdatePositionUseCase from "@modules/department/core/app/use-cases/position/UpdatePositionUseCase";
import { createIamAccessControl } from "@modules/iam";
import { Db as MongoDb } from "mongodb";

/**
 * Lắp ráp use-case của module Department trên nền MongoDB — điểm nối
 * (composition root) giữa core, driven adapter và cổng quyền hạn của IAM.
 *
 * `createIamAccessControl` khớp hình dạng `PermissionChecker` của Department
 * (`assertPermission(actorUserId, permissionKey)`) nên dùng thẳng, không cần
 * lớp adapter trung gian.
 */
export default function createDepartmentHttpUseCases(mongoDb: MongoDb): DepartmentHttpUseCases {
    const departmentRepo  = new MongoDepartmentRepo(mongoDb);
    const positionRepo    = new MongoPositionRepo(mongoDb);
    const permissionCheck = createIamAccessControl(mongoDb);

    return {
        // Department
        createDepartment:     new CreateDepartmentUseCase(permissionCheck, departmentRepo),
        updateDepartment:     new UpdateDepartmentUseCase(permissionCheck, departmentRepo),
        getDepartment:        new GetDepartmentUseCase(departmentRepo),
        listDepartments:      new ListDepartmentsUseCase(departmentRepo),
        reparentDepartment:   new ReparentDepartmentUseCase(permissionCheck, departmentRepo),
        assignDepartmentHead: new AssignDepartmentHeadUseCase(permissionCheck, departmentRepo),
        archiveDepartment:    new ArchiveDepartmentUseCase(permissionCheck, departmentRepo),
        deleteDepartment:     new DeleteDepartmentUseCase(permissionCheck, departmentRepo, positionRepo),

        // Position
        createPosition:  new CreatePositionUseCase(permissionCheck, positionRepo, departmentRepo),
        updatePosition:  new UpdatePositionUseCase(permissionCheck, positionRepo, departmentRepo),
        getPosition:     new GetPositionUseCase(positionRepo),
        listPositions:   new ListPositionsUseCase(positionRepo),
        archivePosition: new ArchivePositionUseCase(permissionCheck, positionRepo),
        deletePosition:  new DeletePositionUseCase(permissionCheck, positionRepo),
    };
}
