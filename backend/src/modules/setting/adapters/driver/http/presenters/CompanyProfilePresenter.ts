import CompanyProfile from "@modules/setting/core/domain/entities/CompanyProfile";

export interface CompanyProfileDTO {
    id:                        string;
    name:                      string;
    address:                   string | null;
    taxCode:                   string | null;
    phone:                     string | null;
    email:                     string | null;
    logoUrl:                   string | null;
    timezone:                  string;
    currency:                  string;
    standardWorkHoursPerDay:   number;
    standardWorkDaysPerMonth:  number;
    createdAt:                 string;
    updatedAt:                 string;
}

const CompanyProfilePresenter = {
    toDTO(profile: CompanyProfile): CompanyProfileDTO {
        return {
            id:                        profile.id,
            name:                      profile.name,
            address:                   profile.address,
            taxCode:                   profile.taxCode,
            phone:                     profile.phone,
            email:                     profile.email,
            logoUrl:                   profile.logoUrl,
            timezone:                  profile.timezone,
            currency:                  profile.currency,
            standardWorkHoursPerDay:   profile.standardWorkHoursPerDay,
            standardWorkDaysPerMonth: profile.standardWorkDaysPerMonth,
            createdAt:                 profile.createdAt.toISOString(),
            updatedAt:                 profile.updatedAt.toISOString(),
        };
    },
};

export default CompanyProfilePresenter;
