import CriteriaSet from "@modules/performance/core/domain/entities/CriteriaSet";

export interface CriterionDTO {
    id:     string;
    code:   string;
    name:   string;
    kind:   string;
    weight: number;
}

export interface CriteriaVersionDTO {
    version:     number;
    criteria:    CriterionDTO[];
    publishedAt: string;
    publishedBy: string;
}

export interface CriteriaSetDTO {
    id:            string;
    name:          string;
    description:   string | null;
    versions:      CriteriaVersionDTO[];
    latestVersion: number | null;
    createdAt:     string;
}

const CriteriaSetPresenter = {
    toDTO(criteriaSet: CriteriaSet): CriteriaSetDTO {
        return {
            id:          criteriaSet.id,
            name:        criteriaSet.name,
            description: criteriaSet.description,
            versions:    criteriaSet.versions.map(version => ({
                version:     version.version,
                publishedAt: version.publishedAt.toISOString(),
                publishedBy: version.publishedBy,
                criteria:    version.criteria.map(criterion => ({
                    id:     criterion.id,
                    code:   criterion.code,
                    name:   criterion.name,
                    kind:   criterion.kind.value,
                    weight: criterion.weight,
                })),
            })),
            latestVersion: criteriaSet.latestVersion?.version ?? null,
            createdAt:     criteriaSet.createdAt.toISOString(),
        };
    },
};

export default CriteriaSetPresenter;
