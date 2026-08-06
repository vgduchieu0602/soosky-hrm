import EmployeeSubResourceNotFoundError from "@modules/employee/core/app/errors/EmployeeSubResourceNotFoundError";
import EmployeeProfileRepo from "@modules/employee/core/app/ports/EmployeeProfileRepo";
import EmployeeAccessScope from "@modules/employee/core/app/services/EmployeeAccessScope";
import EmployeeProfile from "@modules/employee/core/domain/entities/EmployeeProfile";

export interface GetEmployeeProfileInput {
    employeeId:  string;
    actorUserId: string;
}

/**
 * Lấy hồ sơ cá nhân (1-1) của một nhân viên, trong phạm vi actor được đọc.
 *
 * @throws {AccessDeniedError}                Actor không được đọc hồ sơ này.
 * @throws {EmployeeSubResourceNotFoundError} Nhân viên chưa có hồ sơ.
 */
export default class GetEmployeeProfileUseCase {
    public constructor(
        private readonly _accessScope: EmployeeAccessScope,
        private readonly _profileRepo: EmployeeProfileRepo,
    ) {}

    public async execute(input: GetEmployeeProfileInput): Promise<EmployeeProfile> {
        await this._accessScope.assertCanRead(input.actorUserId, input.employeeId);

        const profile = await this._profileRepo.getByEmployeeId(input.employeeId);
        if (profile == undefined) throw new EmployeeSubResourceNotFoundError();
        return profile;
    }
}
