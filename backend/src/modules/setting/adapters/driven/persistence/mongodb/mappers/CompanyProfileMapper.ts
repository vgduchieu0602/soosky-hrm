import CompanyProfileDocument from "@modules/setting/adapters/driven/persistence/mongodb/documents/CompanyProfileDocument";
import CompanyProfile from "@modules/setting/core/domain/entities/CompanyProfile";

const CompanyProfileMapper = {
    toDocument(profile: CompanyProfile): CompanyProfileDocument {
        return {
            _id:                       profile.id,
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
            createdAt:                 profile.createdAt,
            updatedAt:                 profile.updatedAt,
        };
    },

    toDomain(document: CompanyProfileDocument): CompanyProfile {
        return CompanyProfile.rehydrate({
            id:                        document._id,
            name:                      document.name,
            address:                   document.address,
            taxCode:                   document.taxCode,
            phone:                     document.phone,
            email:                     document.email,
            logoUrl:                   document.logoUrl,
            timezone:                  document.timezone,
            currency:                  document.currency,
            standardWorkHoursPerDay:   document.standardWorkHoursPerDay,
            standardWorkDaysPerMonth: document.standardWorkDaysPerMonth,
            createdAt:                 document.createdAt,
            updatedAt:                 document.updatedAt,
        });
    },
};

export default CompanyProfileMapper;
