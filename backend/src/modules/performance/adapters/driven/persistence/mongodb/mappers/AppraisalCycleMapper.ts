import AppraisalCycleDocument from "@modules/performance/adapters/driven/persistence/mongodb/documents/AppraisalCycleDocument";
import AppraisalCycle, { CycleStatus } from "@modules/performance/core/domain/entities/AppraisalCycle";

const AppraisalCycleMapper = {
    toDocument(cycle: AppraisalCycle): AppraisalCycleDocument {
        return {
            _id:             cycle.id,
            name:            cycle.name,
            payrollPeriodId: cycle.payrollPeriodId,
            criteriaSetId:   cycle.criteriaSetId,
            criteriaVersion: cycle.criteriaVersion,
            status:          cycle.status,
            createdBy:       cycle.createdBy,
            createdAt:       cycle.createdAt,
            activatedAt:     cycle.activatedAt,
            closedAt:        cycle.closedAt,
        };
    },

    toDomain(document: AppraisalCycleDocument): AppraisalCycle {
        return AppraisalCycle.rehydrate({
            id:              document._id,
            name:            document.name,
            payrollPeriodId: document.payrollPeriodId,
            criteriaSetId:   document.criteriaSetId,
            criteriaVersion: document.criteriaVersion,
            status:          document.status as CycleStatus,
            createdBy:       document.createdBy,
            createdAt:       document.createdAt,
            activatedAt:     document.activatedAt,
            closedAt:        document.closedAt,
        });
    },
};

export default AppraisalCycleMapper;
