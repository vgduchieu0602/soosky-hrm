import Shift from "@modules/attendance/core/domain/entities/Shift";

export default interface ShiftRepo {
    getById(id: string): Promise<Shift | undefined>;
    getByCode(code: string): Promise<Shift | undefined>;
    listAll(): Promise<Shift[]>;
    listActive(): Promise<Shift[]>;
    save(shift: Shift): Promise<void>;
    deleteById(id: string): Promise<void>;
}
