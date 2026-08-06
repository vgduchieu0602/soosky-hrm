import AppraisalCycle from "@modules/performance/core/domain/entities/AppraisalCycle";

export interface AppraisalCycleDTO {
    id:              string;
    name:            string;
    payrollPeriodId: string;
    criteriaSetId:   string;
    criteriaVersion: number;
    status:          string;
    createdAt:       string;
    activatedAt:     string | null;
    closedAt:        string | null;
}

const AppraisalCyclePresenter = {
    toDTO(cycle: AppraisalCycle): AppraisalCycleDTO {
        return {
            id:              cycle.id,
            name:            cycle.name,
            payrollPeriodId: cycle.payrollPeriodId,
            criteriaSetId:   cycle.criteriaSetId,
            criteriaVersion: cycle.criteriaVersion,
            status:          cycle.status,
            createdAt:       cycle.createdAt.toISOString(),
            activatedAt:     cycle.activatedAt?.toISOString() ?? null,
            closedAt:        cycle.closedAt?.toISOString() ?? null,
        };
    },
};

export default AppraisalCyclePresenter;
