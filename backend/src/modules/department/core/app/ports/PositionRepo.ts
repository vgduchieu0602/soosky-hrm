import Position from "@modules/department/core/domain/entities/Position";

export interface PositionListFilter {
    departmentId?: string;
    status?:       string;
}

export default interface PositionRepo {
    getById(id: string): Promise<Position | undefined>;
    getByCode(code: string): Promise<Position | undefined>;
    list(filter: PositionListFilter): Promise<Position[]>;
    countByDepartment(departmentId: string): Promise<number>;
    save(position: Position): Promise<void>;
    deleteById(id: string): Promise<void>;
}
