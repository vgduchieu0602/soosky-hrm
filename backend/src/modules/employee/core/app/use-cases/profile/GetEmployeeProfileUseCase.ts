import EmployeeSubResourceNotFoundError from "@modules/employee/core/app/errors/EmployeeSubResourceNotFoundError";
import EmployeeProfileRepo from "@modules/employee/core/app/ports/EmployeeProfileRepo";
import EmployeeProfile from "@modules/employee/core/domain/entities/EmployeeProfile";

export interface GetEmployeeProfileInput {
    employeeId: string;
}

/**
 * Lấy hồ sơ cá nhân (1-1) của một nhân viên.
 *
 * @throws {EmployeeSubResourceNotFoundError} Nhân viên chưa có hồ sơ.
 */
export default class GetEmployeeProfileUseCase {
    public constructor(
        private readonly _profileRepo: EmployeeProfileRepo,
    ) {}

    public async execute(input: GetEmployeeProfileInput): Promise<EmployeeProfile> {
        const profile = await this._profileRepo.getByEmployeeId(input.employeeId);
        if (profile == undefined) throw new EmployeeSubResourceNotFoundError();
        return profile;
    }
}
