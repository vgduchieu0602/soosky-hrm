import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeStatus from "@modules/employee/core/domain/value-objects/EmployeeStatus";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface EmployeeCreationInput {
    id:           string;
    code:         EmployeeCode;
    name:         PersonName;
    email:        string | null;
    phone:        string | null;
    dob:          Date | null;
    gender:       string | null;
    departmentId: string;
    positionId:   string;
    managerId:    string | null;
    hireDate:     Date;
    employeeType: EmployeeType;
    accountId:    string | null;
}

export interface EmployeeProps {
    id:              string;
    code:            EmployeeCode;
    name:            PersonName;
    email:           string | null;
    phone:           string | null;
    dob:             Date | null;
    gender:          string | null;
    departmentId:    string;
    positionId:      string;
    managerId:       string | null;
    hireDate:        Date;
    terminationDate: Date | null;
    employeeType:    EmployeeType;
    status:          EmployeeStatus;
    accountId:       string | null;
    createdAt:       Date;
}

/**
 * Aggregate nhân viên — trung tâm module Employee. Giữ tham chiếu (id mờ) tới
 * `departmentId`/`positionId` (module Department) và `managerId` (nhân viên
 * khác trong chính module này). `accountId` là liên kết tuỳ chọn tới tài
 * khoản đăng nhập do module Auth quản lý — module Employee không cấp phát
 * hay chỉnh sửa trường này.
 */
export default class Employee extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _code: EmployeeCode,
        private _name: PersonName,
        private _email: string | null,
        private _phone: string | null,
        private _dob: Date | null,
        private _gender: string | null,
        private _departmentId: string,
        private _positionId: string,
        private _managerId: string | null,
        private _hireDate: Date,
        private _terminationDate: Date | null,
        private _employeeType: EmployeeType,
        private _status: EmployeeStatus,
        private _accountId: string | null,
    ) {
        super();
    }

    get code(): EmployeeCode { return this._code; }
    get name(): PersonName { return this._name; }
    get email(): string | null { return this._email; }
    get phone(): string | null { return this._phone; }
    get dob(): Date | null { return this._dob; }
    get gender(): string | null { return this._gender; }
    get departmentId(): string { return this._departmentId; }
    get positionId(): string { return this._positionId; }
    get managerId(): string | null { return this._managerId; }
    get hireDate(): Date { return this._hireDate; }
    get terminationDate(): Date | null { return this._terminationDate; }
    get employeeType(): EmployeeType { return this._employeeType; }
    get status(): EmployeeStatus { return this._status; }
    get accountId(): string | null { return this._accountId; }

    static create(input: EmployeeCreationInput): Employee {
        return new Employee(
            input.id,
            new Date(),
            input.code,
            input.name,
            input.email,
            input.phone,
            input.dob,
            input.gender,
            input.departmentId,
            input.positionId,
            input.managerId,
            input.hireDate,
            null,
            input.employeeType,
            EmployeeStatus.ONBOARDING,
            input.accountId,
        );
    }

    static rehydrate(props: EmployeeProps): Employee {
        return new Employee(
            props.id,
            props.createdAt,
            props.code,
            props.name,
            props.email,
            props.phone,
            props.dob,
            props.gender,
            props.departmentId,
            props.positionId,
            props.managerId,
            props.hireDate,
            props.terminationDate,
            props.employeeType,
            props.status,
            props.accountId,
        );
    }

    rename(name: PersonName): void {
        this._name = name;
    }

    changeCode(code: EmployeeCode): void {
        this._code = code;
    }

    updateContactInfo(email: string | null, phone: string | null): void {
        this._email = email;
        this._phone = phone;
    }

    transferDepartment(departmentId: string): void {
        this._departmentId = departmentId;
    }

    transferPosition(positionId: string): void {
        this._positionId = positionId;
    }

    assignManager(managerId: string | null): void {
        this._managerId = managerId;
    }

    changeEmployeeType(employeeType: EmployeeType): void {
        this._employeeType = employeeType;
    }

    activate(): void {
        this._status = EmployeeStatus.ACTIVE;
    }

    setOnLeave(): void {
        this._status = EmployeeStatus.ON_LEAVE;
    }

    /** Nghỉ việc — soft update: không xoá bản ghi, chỉ đổi trạng thái + ngày nghỉ việc. */
    terminate(terminationDate: Date): void {
        this._status          = EmployeeStatus.TERMINATED;
        this._terminationDate = terminationDate;
    }
}
