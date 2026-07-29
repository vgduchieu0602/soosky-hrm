import EmployeeMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeMongoDoc";
import Employee from "@modules/employee/core/domain/entities/Employee";
import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeStatus from "@modules/employee/core/domain/value-objects/EmployeeStatus";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";

const EmployeeMapper = {
    toDocument(employee: Employee): EmployeeMongoDoc {
        return {
            _id:             employee.id,
            code:            employee.code.value,
            name:            employee.name.value,
            email:           employee.email,
            phone:           employee.phone,
            dob:             employee.dob,
            gender:          employee.gender,
            departmentId:    employee.departmentId,
            positionId:      employee.positionId,
            managerId:       employee.managerId,
            hireDate:        employee.hireDate,
            terminationDate: employee.terminationDate,
            employeeType:    employee.employeeType.value,
            status:          employee.status.value,
            accountId:       employee.accountId,
            createdAt:       employee.createdAt,
        };
    },

    toDomain(document: EmployeeMongoDoc): Employee {
        return Employee.rehydrate({
            id:              document._id,
            code:            EmployeeCode.create(document.code),
            name:            PersonName.create(document.name),
            email:           document.email,
            phone:           document.phone,
            dob:             document.dob,
            gender:          document.gender,
            departmentId:    document.departmentId,
            positionId:      document.positionId,
            managerId:       document.managerId,
            hireDate:        document.hireDate,
            terminationDate: document.terminationDate,
            employeeType:    EmployeeType.create(document.employeeType),
            status:          EmployeeStatus.create(document.status),
            accountId:       document.accountId,
            createdAt:       document.createdAt,
        });
    },
};

export default EmployeeMapper;
