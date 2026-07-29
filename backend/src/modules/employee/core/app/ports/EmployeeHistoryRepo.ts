import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";

export default interface EmployeeHistoryRepo {
    listByEmployeeId(employeeId: string): Promise<EmployeeHistory[]>;
    save(history: EmployeeHistory): Promise<void>;
}
