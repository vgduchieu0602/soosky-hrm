import EmployeeContactMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeContactMongoDoc";
import EmployeeContact, { Relationship } from "@modules/employee/core/domain/entities/EmployeeContact";

const EmployeeContactMapper = {
    toDocument(contact: EmployeeContact): EmployeeContactMongoDoc {
        return {
            _id:          contact.id,
            employeeId:   contact.employeeId,
            name:         contact.name,
            relationship: contact.relationship,
            phone:        contact.phone,
            email:        contact.email,
            address:      contact.address,
            isPrimary:    contact.isPrimary,
            createdAt:    contact.createdAt,
        };
    },

    toDomain(document: EmployeeContactMongoDoc): EmployeeContact {
        return EmployeeContact.rehydrate({
            id:           document._id,
            employeeId:   document.employeeId,
            name:         document.name,
            relationship: document.relationship as Relationship,
            phone:        document.phone,
            email:        document.email,
            address:      document.address,
            isPrimary:    document.isPrimary,
            createdAt:    document.createdAt,
        });
    },
};

export default EmployeeContactMapper;
