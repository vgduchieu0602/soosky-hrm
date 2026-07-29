import EmployeeNotFoundError from "@modules/employee/core/app/errors/EmployeeNotFoundError";
import EmployeeAssetRepo from "@modules/employee/core/app/ports/EmployeeAssetRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import EmployeeAsset, { AssetCondition } from "@modules/employee/core/domain/entities/EmployeeAsset";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "employee:manage";

export interface CreateEmployeeAssetInput {
    employeeId:   string;
    assetName:    string;
    assetCode:    string;
    assignedDate: Date;
    condition?: AssetCondition | undefined;
    note?: string | undefined;
    actorUserId:  string;
}

export interface CreateEmployeeAssetOutput {
    assetId: string;
}

/**
 * Cấp phát tài sản công ty cho nhân viên.
 *
 * @throws {AccessDeniedError}     Actor không có quyền `employee:manage`.
 * @throws {EmployeeNotFoundError} Nhân viên không tồn tại.
 */
export default class CreateEmployeeAssetUseCase {
    public constructor(
        private readonly _permissions:  PermissionChecker,
        private readonly _employeeRepo: EmployeeRepo,
        private readonly _assetRepo:    EmployeeAssetRepo,
    ) {}

    public async execute(input: CreateEmployeeAssetInput): Promise<CreateEmployeeAssetOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const employee = await this._employeeRepo.getById(input.employeeId);
        if (employee == undefined) throw new EmployeeNotFoundError();

        const asset = EmployeeAsset.create({
            id:           UUIDv7(),
            employeeId:   input.employeeId,
            assetName:    input.assetName,
            assetCode:    input.assetCode,
            assignedDate: input.assignedDate,
            returnedDate: null,
            condition:    input.condition ?? "good",
            note:         input.note ?? null,
        });

        await this._assetRepo.save(asset);

        return { assetId: asset.id };
    }
}
