import Holiday from "@modules/attendance/core/domain/entities/Holiday";

export default interface HolidayRepo {
    getById(id: string): Promise<Holiday | undefined>;
    listAll(): Promise<Holiday[]>;
    /** Ngày lễ cố định trong [start, end] cộng toàn bộ ngày lễ lặp lại (khớp theo mm-dd bất kể năm). */
    listOverlapping(start: Date, end: Date): Promise<Holiday[]>;
    save(holiday: Holiday): Promise<void>;
    deleteById(id: string): Promise<void>;
}
