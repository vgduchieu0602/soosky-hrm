import Holiday from "@modules/attendance/core/domain/entities/Holiday";

export interface HolidayDTO {
    id:          string;
    name:        string;
    date:        string;
    isRecurring: boolean;
    createdAt:   string;
}

const HolidayPresenter = {
    toDTO(holiday: Holiday): HolidayDTO {
        return {
            id:          holiday.id,
            name:        holiday.name.value,
            date:        holiday.date.toISOString(),
            isRecurring: holiday.isRecurring,
            createdAt:   holiday.createdAt.toISOString(),
        };
    },
};

export default HolidayPresenter;
