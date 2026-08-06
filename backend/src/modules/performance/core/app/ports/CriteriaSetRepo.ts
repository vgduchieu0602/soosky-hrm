import CriteriaSet from "@modules/performance/core/domain/entities/CriteriaSet";

export default interface CriteriaSetRepo {
    getById(id: string): Promise<CriteriaSet | undefined>;
    listAll(): Promise<CriteriaSet[]>;
    save(criteriaSet: CriteriaSet): Promise<void>;
}
