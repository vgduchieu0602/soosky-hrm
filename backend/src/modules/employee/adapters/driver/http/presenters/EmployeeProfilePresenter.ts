import EmployeeProfile from "@modules/employee/core/domain/entities/EmployeeProfile";

export interface EmployeeProfileDTO {
    id:                string;
    employeeId:        string;
    firstName:         string;
    lastName:          string;
    middleName:        string | null;
    dateOfBirth:       string | null;
    gender:            string | null;
    nationality:       string | null;
    maritalStatus:     string | null;
    avatarUrl:         string | null;
    personalEmail:     string | null;
    workEmail:         string | null;
    phone:             string | null;
    address:           string | null;
    socialInsuranceNo: string | null;
    taxCode:           string | null;
    vehiclePlate:      string | null;
    createdAt:         string;
}

const EmployeeProfilePresenter = {
    toDTO(profile: EmployeeProfile): EmployeeProfileDTO {
        return {
            id:                profile.id,
            employeeId:        profile.employeeId,
            firstName:         profile.firstName,
            lastName:          profile.lastName,
            middleName:        profile.middleName,
            dateOfBirth:       profile.dateOfBirth?.toISOString() ?? null,
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
            createdAt:         profile.createdAt.toISOString(),
        };
    },
};

export default EmployeeProfilePresenter;
