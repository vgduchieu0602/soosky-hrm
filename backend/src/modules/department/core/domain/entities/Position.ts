import Description from "@modules/department/core/domain/value-objects/Description";
import PositionCode from "@modules/department/core/domain/value-objects/PositionCode";
import PositionLevel from "@modules/department/core/domain/value-objects/PositionLevel";
import PositionStatus from "@modules/department/core/domain/value-objects/PositionStatus";
import PositionTitle from "@modules/department/core/domain/value-objects/PositionTitle";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface PositionCreationInput {
    id:           string;
    code:         PositionCode;
    title:        PositionTitle;
    departmentId: string;
    level:        PositionLevel;
    description:  Description;
}

export interface PositionProps {
    id:           string;
    code:         PositionCode;
    title:        PositionTitle;
    departmentId: string;
    level:        PositionLevel;
    description:  Description;
    status:       PositionStatus;
    createdAt:    Date;
}

/**
 * Aggregate vị trí công việc, thuộc về một phòng ban. `archived` để ẩn khỏi
 * bộ chọn nhưng vẫn giữ tham chiếu lịch sử.
 */
export default class Position extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _code: PositionCode,
        private _title: PositionTitle,
        private _departmentId: string,
        private _level: PositionLevel,
        private _description: Description,
        private _status: PositionStatus,
    ) {
        super();
    }

    get code(): PositionCode {
        return this._code;
    }
    get title(): PositionTitle {
        return this._title;
    }
    get departmentId(): string {
        return this._departmentId;
    }
    get level(): PositionLevel {
        return this._level;
    }
    get description(): Description {
        return this._description;
    }
    get status(): PositionStatus {
        return this._status;
    }

    static create(input: PositionCreationInput): Position {
        return new Position(
            input.id,
            new Date(),
            input.code,
            input.title,
            input.departmentId,
            input.level,
            input.description,
            PositionStatus.ACTIVE,
        );
    }

    static rehydrate(props: PositionProps): Position {
        return new Position(
            props.id,
            props.createdAt,
            props.code,
            props.title,
            props.departmentId,
            props.level,
            props.description,
            props.status,
        );
    }

    rename(title: PositionTitle): void {
        this._title = title;
    }

    changeDescription(description: Description): void {
        this._description = description;
    }

    changeLevel(level: PositionLevel): void {
        this._level = level;
    }

    moveToDepartment(departmentId: string): void {
        this._departmentId = departmentId;
    }

    archive(): void {
        this._status = PositionStatus.ARCHIVED;
    }

    activate(): void {
        this._status = PositionStatus.ACTIVE;
    }
}
