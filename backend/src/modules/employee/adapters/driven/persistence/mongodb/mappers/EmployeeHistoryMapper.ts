import EmployeeHistoryMongoDoc from "@modules/employee/adapters/driven/persistence/mongodb/documents/EmployeeHistoryMongoDoc";
import EmployeeHistory, { HistoryEvent } from "@modules/employee/core/domain/entities/EmployeeHistory";

const EmployeeHistoryMapper = {
    toDocument(history: EmployeeHistory): EmployeeHistoryMongoDoc {
        return {
            _id:             history.id,
            employeeId:      history.employeeId,
            eventType:       history.eventType,
            fromValue:       history.fromValue,
            toValue:         history.toValue,
            effectiveDate:   history.effectiveDate,
            note:            history.note,
            createdByUserId: history.createdByUserId,
            createdAt:       history.createdAt,
        };
    },

    toDomain(document: EmployeeHistoryMongoDoc): EmployeeHistory {
        return EmployeeHistory.rehydrate({
            id:              document._id,
            employeeId:      document.employeeId,
            eventType:       document.eventType as HistoryEvent,
            fromValue:       document.fromValue,
            toValue:         document.toValue,
            effectiveDate:   document.effectiveDate,
            note:            document.note,
            createdByUserId: document.createdByUserId,
            createdAt:       document.createdAt,
        });
    },
};

export default EmployeeHistoryMapper;
