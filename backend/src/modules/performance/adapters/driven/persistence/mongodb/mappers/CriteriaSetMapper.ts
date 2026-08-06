import CriteriaSetDocument from "@modules/performance/adapters/driven/persistence/mongodb/documents/CriteriaSetDocument";
import CriteriaSet from "@modules/performance/core/domain/entities/CriteriaSet";
import CriterionKind from "@modules/performance/core/domain/value-objects/CriterionKind";

const CriteriaSetMapper = {
    toDocument(criteriaSet: CriteriaSet): CriteriaSetDocument {
        return {
            _id:         criteriaSet.id,
            name:        criteriaSet.name,
            description: criteriaSet.description,
            versions:    criteriaSet.versions.map(version => ({
                version:     version.version,
                publishedAt: version.publishedAt,
                publishedBy: version.publishedBy,
                criteria:    version.criteria.map(criterion => ({
                    id:     criterion.id,
                    code:   criterion.code,
                    name:   criterion.name,
                    kind:   criterion.kind.value,
                    weight: criterion.weight,
                })),
            })),
            createdBy:   criteriaSet.createdBy,
            createdAt:   criteriaSet.createdAt,
        };
    },

    toDomain(document: CriteriaSetDocument): CriteriaSet {
        return CriteriaSet.rehydrate({
            id:          document._id,
            name:        document.name,
            description: document.description,
            versions:    document.versions.map(version => ({
                version:     version.version,
                publishedAt: version.publishedAt,
                publishedBy: version.publishedBy,
                criteria:    version.criteria.map(criterion => ({
                    id:     criterion.id,
                    code:   criterion.code,
                    name:   criterion.name,
                    kind:   CriterionKind.create(criterion.kind),
                    weight: criterion.weight,
                })),
            })),
            createdBy:   document.createdBy,
            createdAt:   document.createdAt,
        });
    },
};

export default CriteriaSetMapper;
