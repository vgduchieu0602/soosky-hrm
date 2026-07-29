import Employee from "@modules/employee/core/domain/entities/Employee";

export interface EmployeeDTO {
    id:              string;
    code:            string;
    name:            string;
    email:           string | null;
    phone:           string | null;
    dob:             string | null;
    gender:          string | null;
    departmentId:    string;
    positionId:      string;
    managerId:       string | null;
    hireDate:        string;
    terminationDate: string | null;
    employeeType:    string;
    status:          string;
    accountId:       string | null;
    createdAt:       string;
}

const EmployeePresenter = {
    toDTO(employee: Employee): EmployeeDTO {
        return {
            id:              employee.id,
            code:            employee.code.value,
            name:            employee.name.value,
            email:           employee.email,
            phone:           employee.phone,
            dob:             employee.dob?.toISOString() ?? null,
            gender:          employee.gender,
            departmentId:    employee.departmentId,
            positionId:      employee.positionId,
            managerId:       employee.managerId,
            hireDate:        employee.hireDate.toISOString(),
            terminationDate: employee.terminationDate?.toISOString() ?? null,
            employeeType:    employee.employeeType.value,
            status:          employee.status.value,
            accountId:       employee.accountId,
            createdAt:       employee.createdAt.toISOString(),
        };
    },
};

export default EmployeePresenter;
