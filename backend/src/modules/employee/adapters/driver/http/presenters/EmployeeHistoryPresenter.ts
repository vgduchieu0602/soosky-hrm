import EmployeeHistory from "@modules/employee/core/domain/entities/EmployeeHistory";

export interface EmployeeHistoryDTO {
    id:              string;
    employeeId:      string;
    eventType:       string;
    fromValue:       Record<string, unknown> | null;
    toValue:         Record<string, unknown> | null;
    effectiveDate:   string;
    note:            string | null;
    createdByUserId: string | null;
    createdAt:       string;
}

const EmployeeHistoryPresenter = {
    toDTO(history: EmployeeHistory): EmployeeHistoryDTO {
        return {
            id:              history.id,
            employeeId:      history.employeeId,
            eventType:       history.eventType,
            fromValue:       history.fromValue,
            toValue:         history.toValue,
            effectiveDate:   history.effectiveDate.toISOString(),
            note:            history.note,
            createdByUserId: history.createdByUserId,
            createdAt:       history.createdAt.toISOString(),
        };
    },
};

export default EmployeeHistoryPresenter;
