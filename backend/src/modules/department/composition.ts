import { MongoDepartmentRepo, MongoPositionRepo } from "@modules/department/adapters/driven/persistence/mongodb";
import { Db as MongoDb } from "mongodb";

/**
 * Cổng tra cứu sự tồn tại của phòng ban/vị trí mà module khác (vd: Employee)
 * được phép tiêu thụ, KHÔNG cần import trực tiếp repo Mongo nội bộ của
 * Department.
 */
export interface DepartmentDirectory {
    departmentExists(departmentId: string): Promise<boolean>;
    positionExists(positionId: string): Promise<boolean>;
}

/**
 * Lắp `DepartmentDirectory` trên nền MongoDB — điểm nối duy nhất để module
 * khác dùng dữ liệu tồn tại của Department mà vẫn giữ ranh giới module: chỉ
 * composition root (infra) mới được phép import cả hai module để nối dây.
 */
export function createDepartmentDirectory(mongoDb: MongoDb): DepartmentDirectory {
    const departmentRepo = new MongoDepartmentRepo(mongoDb);
    const positionRepo   = new MongoPositionRepo(mongoDb);

    return {
        departmentExists: async (departmentId: string) => (await departmentRepo.getById(departmentId)) != undefined,
        positionExists:    async (positionId: string) => (await positionRepo.getById(positionId)) != undefined,
    };
}
