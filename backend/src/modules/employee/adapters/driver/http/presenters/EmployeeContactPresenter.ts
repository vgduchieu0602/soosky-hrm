import EmployeeContact from "@modules/employee/core/domain/entities/EmployeeContact";

export interface EmployeeContactDTO {
    id:           string;
    employeeId:   string;
    name:         string;
    relationship: string;
    phone:        string | null;
    email:        string | null;
    address:      string | null;
    isPrimary:    boolean;
    createdAt:    string;
}

const EmployeeContactPresenter = {
    toDTO(contact: EmployeeContact): EmployeeContactDTO {
        return {
            id:           contact.id,
            employeeId:   contact.employeeId,
            name:         contact.name,
            relationship: contact.relationship,
            phone:        contact.phone,
            email:        contact.email,
            address:      contact.address,
            isPrimary:    contact.isPrimary,
            createdAt:    contact.createdAt.toISOString(),
        };
    },
};

export default EmployeeContactPresenter;
