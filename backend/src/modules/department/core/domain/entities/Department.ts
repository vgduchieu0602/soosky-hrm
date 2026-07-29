import DepartmentCode from "@modules/department/core/domain/value-objects/DepartmentCode";
import DepartmentName from "@modules/department/core/domain/value-objects/DepartmentName";
import DepartmentStatus from "@modules/department/core/domain/value-objects/DepartmentStatus";
import Description from "@modules/department/core/domain/value-objects/Description";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface DepartmentCreationInput {
    id:                 string;
    code:               DepartmentCode;
    name:               DepartmentName;
    description:        Description;
    parentDepartmentId: string | null;
    managerId:          string | null;
}

export interface DepartmentProps {
    id:                 string;
    code:               DepartmentCode;
    name:               DepartmentName;
    description:        Description;
    parentDepartmentId: string | null;
    managerId:          string | null;
    status:             DepartmentStatus;
    createdAt:          Date;
}

/**
 * Aggregate phòng ban — phạm vi toàn công ty (không gắn workspace). Giữ quan hệ
 * cha/con qua `parentDepartmentId` và người phụ trách qua `managerId` (id mờ, chưa
 * ràng buộc tới module nhân sự).
 */
export default class Department extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _code: DepartmentCode,
        private _name: DepartmentName,
        private _description: Description,
        private _parentDepartmentId: string | null,
        private _managerId: string | null,
        private _status: DepartmentStatus,
    ) {
        super();
    }

    get code(): DepartmentCode {
        return this._code;
    }
    get name(): DepartmentName {
        return this._name;
    }
    get description(): Description {
        return this._description;
    }
    get parentDepartmentId(): string | null {
        return this._parentDepartmentId;
    }
    get managerId(): string | null {
        return this._managerId;
    }
    get status(): DepartmentStatus {
        return this._status;
    }

    static create(input: DepartmentCreationInput): Department {
        return new Department(
            input.id,
            new Date(),
            input.code,
            input.name,
            input.description,
            input.parentDepartmentId,
            input.managerId,
            DepartmentStatus.ACTIVE,
        );
    }

    static rehydrate(props: DepartmentProps): Department {
        return new Department(
            props.id,
            props.createdAt,
            props.code,
            props.name,
            props.description,
            props.parentDepartmentId,
            props.managerId,
            props.status,
        );
    }

    rename(name: DepartmentName): void {
        this._name = name;
    }

    changeCode(code: DepartmentCode): void {
        this._code = code;
    }

    changeDescription(description: Description): void {
        this._description = description;
    }

    reparent(parentDepartmentId: string | null): void {
        this._parentDepartmentId = parentDepartmentId;
    }

    assignHead(managerId: string): void {
        this._managerId = managerId;
    }

    removeHead(): void {
        this._managerId = null;
    }

    archive(): void {
        this._status = DepartmentStatus.ARCHIVED;
    }

    activate(): void {
        this._status = DepartmentStatus.ACTIVE;
    }
}
