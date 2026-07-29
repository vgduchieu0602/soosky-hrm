import CompanyProfile from "@modules/setting/core/domain/entities/CompanyProfile";

export default interface CompanyProfileRepo {
    get(): Promise<CompanyProfile | undefined>;
    save(companyProfile: CompanyProfile): Promise<void>;
}
