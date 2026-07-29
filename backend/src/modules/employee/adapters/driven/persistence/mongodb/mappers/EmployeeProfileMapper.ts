import EmployeeProfileMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeProfileMongoDoc";
import EmployeeProfile from "@modules/employee/core/domain/entities/EmployeeProfile";

const EmployeeProfileMapper = {
    toDocument(profile: EmployeeProfile): EmployeeProfileMongoDoc {
        return {
            _id:               profile.id,
            employeeId:        profile.employeeId,
            firstName:         profile.firstName,
            lastName:          profile.lastName,
            middleName:        profile.middleName,
            dateOfBirth:       profile.dateOfBirth,
            gender:            profile.gender,
            nationality:       profile.nationality,
            maritalStatus:     profile.maritalStatus,
            avatarUrl:         profile.avatarUrl,
            personalEmail:     profile.personalEmail,
            workEmail:         profile.workEmail,
            phone:             profile.phone,
            address:           profile.address,
            socialInsuranceNo: profile.socialInsuranceNo,
            taxCode:           profile.taxCode,
            vehiclePlate:      profile.vehiclePlate,
            createdAt:         profile.createdAt,
        };
    },

    toDomain(document: EmployeeProfileMongoDoc): EmployeeProfile {
        return EmployeeProfile.rehydrate({
            id:                document._id,
            employeeId:        document.employeeId,
            firstName:         document.firstName,
            lastName:          document.lastName,
            middleName:        document.middleName,
            dateOfBirth:       document.dateOfBirth,
            gender:            document.gender,
            nationality:       document.nationality,
            maritalStatus:     document.maritalStatus,
            avatarUrl:         document.avatarUrl,
            personalEmail:     document.personalEmail,
            workEmail:         document.workEmail,
            phone:             document.phone,
            address:           document.address,
            socialInsuranceNo: document.socialInsuranceNo,
            taxCode:           document.taxCode,
            vehiclePlate:      document.vehiclePlate,
            createdAt:         document.createdAt,
        });
    },
};

export default EmployeeProfileMapper;
