import DepartmentDocument from "@modules/department/adapters/driven/persistence/mongodb/documents/DepartmentDocument";
import Department from "@modules/department/core/domain/entities/Department";
import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/department/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/department/core/domain/value-objects/Description";

const DepartmentMapper = {
    toDocument(department: Department): DepartmentDocument {
        return {
            _id:                department.id,
            code:               department.code.value,
            name:               department.name.value,
            description:        department.description.value,
            parentDepartmentId: department.parentDepartmentId,
            managerId:          department.managerId,
            status:             department.status.value,
            createdAt:          department.createdAt,
        };
    },

    toDomain(document: DepartmentDocument): Department {
        return Department.rehydrate({
            id:                 document._id,
            code:               DepartmentCode.create(document.code),
            name:               DepartmentName.create(document.name),
            description:        Description.create(document.description),
            parentDepartmentId: document.parentDepartmentId,
            managerId:          document.managerId,
            status:             DepartmentStatus.create(document.status),
            createdAt:          document.createdAt,
        });
    },
};

export default DepartmentMapper;
