import Department from "@modules/department/core/domain/entities/Department";

export interface DepartmentDTO {
    id:                 string;
    code:               string;
    name:               string;
    description:        string;
    parentDepartmentId: string | null;
    managerId:          string | null;
    status:             string;
    createdAt:          string;
}

const DepartmentPresenter = {
    toDTO(department: Department): DepartmentDTO {
        return {
            id:                 department.id,
            code:               department.code.value,
            name:               department.name.value,
            description:        department.description.value,
            parentDepartmentId: department.parentDepartmentId,
            managerId:          department.managerId,
            status:             department.status.value,
            createdAt:          department.createdAt.toISOString(),
        };
    },
};

export default DepartmentPresenter;
