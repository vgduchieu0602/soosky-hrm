import EmployeeProfile from "@modules/employee/core/domain/entities/EmployeeProfile";

export default interface EmployeeProfileRepo {
    getByEmployeeId(employeeId: string): Promise<EmployeeProfile | undefined>;
    save(profile: EmployeeProfile): Promise<void>;
}
