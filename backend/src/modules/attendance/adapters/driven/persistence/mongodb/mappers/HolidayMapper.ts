import HolidayDocument from "@modules/attendance/adapters/driven/persistence/mongodb/documents/HolidayDocument";
import Holiday from "@modules/attendance/core/domain/entities/Holiday";
import HolidayName from "@modules/attendance/core/domain/value-objects/HolidayName";

const HolidayMapper = {
    toDocument(holiday: Holiday): HolidayDocument {
        return {
            _id:         holiday.id,
            name:        holiday.name.value,
            date:        holiday.date,
            isRecurring: holiday.isRecurring,
            createdAt:   holiday.createdAt,
        };
    },

    toDomain(document: HolidayDocument): Holiday {
        return Holiday.rehydrate({
            id:          document._id,
            name:        HolidayName.create(document.name),
            date:        document.date,
            isRecurring: document.isRecurring,
            createdAt:   document.createdAt,
        });
    },
};

export default HolidayMapper;
