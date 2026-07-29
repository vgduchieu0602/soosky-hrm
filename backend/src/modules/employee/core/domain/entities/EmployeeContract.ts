import EmployeeSubResourceInvalidError from "@modules/employee/core/domain/errors/EmployeeSubResourceInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const CONTRACT_TYPES = ["fixed_term", "indefinite"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const EMPLOYMENT_STATUSES = ["probation", "official", "internship"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const CONTRACT_STATUSES = ["active", "expired", "terminated"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export interface EmployeeContractProps {
    id:               string;
    employeeId:       string;
    contractType:     ContractType;
    employmentStatus: EmploymentStatus;
    contractNumber:   string;
    startDate:        Date;
    endDate:          Date | null;
    baseSalary:       number;
    currency:         string;
    fileUrl:          string | null;
    status:           ContractStatus;
    createdAt:        Date;
}

/** Hợp đồng lao động của nhân viên — nhiều bản ghi trên một nhân viên. */
export default class EmployeeContract extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly createdAt: Date,
        private _contractType: ContractType,
        private _employmentStatus: EmploymentStatus,
        private _contractNumber: string,
        private _startDate: Date,
        private _endDate: Date | null,
        private _baseSalary: number,
        private _currency: string,
        private _fileUrl: string | null,
        private _status: ContractStatus,
    ) {
        super();
    }

    get contractType(): ContractType { return this._contractType; }
    get employmentStatus(): EmploymentStatus { return this._employmentStatus; }
    get contractNumber(): string { return this._contractNumber; }
    get startDate(): Date { return this._startDate; }
    get endDate(): Date | null { return this._endDate; }
    get baseSalary(): number { return this._baseSalary; }
    get currency(): string { return this._currency; }
    get fileUrl(): string | null { return this._fileUrl; }
    get status(): ContractStatus { return this._status; }

    static create(props: Omit<EmployeeContractProps, "createdAt">): EmployeeContract {
        return EmployeeContract.rehydrate({ ...props, createdAt: new Date() });
    }

    static rehydrate(props: EmployeeContractProps): EmployeeContract {
        if (!CONTRACT_TYPES.includes(props.contractType)) {
            throw new EmployeeSubResourceInvalidError(`Invalid contract type: ${props.contractType}`);
        }
        if (!EMPLOYMENT_STATUSES.includes(props.employmentStatus)) {
            throw new EmployeeSubResourceInvalidError(`Invalid employment status: ${props.employmentStatus}`);
        }
        if (!CONTRACT_STATUSES.includes(props.status)) {
            throw new EmployeeSubResourceInvalidError(`Invalid contract status: ${props.status}`);
        }
        if (props.contractNumber.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Contract number must not be empty");
        }
        if (props.baseSalary < 0) {
            throw new EmployeeSubResourceInvalidError("Base salary must not be negative");
        }
        return new EmployeeContract(
            props.id, props.employeeId, props.createdAt,
            props.contractType, props.employmentStatus, props.contractNumber.trim(),
            props.startDate, props.endDate, props.baseSalary, props.currency.trim().toUpperCase() || "VND",
            props.fileUrl, props.status,
        );
    }

    update(patch: { employmentStatus?: EmploymentStatus | undefined; endDate?: Date | null | undefined; baseSalary?: number | undefined; fileUrl?: string | null | undefined; status?: ContractStatus | undefined; }): void {
        if (patch.employmentStatus != undefined) {
            if (!EMPLOYMENT_STATUSES.includes(patch.employmentStatus)) throw new EmployeeSubResourceInvalidError(`Invalid employment status: ${patch.employmentStatus}`);
            this._employmentStatus = patch.employmentStatus;
        }
        if (patch.endDate !== undefined) this._endDate = patch.endDate;
        if (patch.baseSalary != undefined) {
            if (patch.baseSalary < 0) throw new EmployeeSubResourceInvalidError("Base salary must not be negative");
            this._baseSalary = patch.baseSalary;
        }
        if (patch.fileUrl !== undefined) this._fileUrl = patch.fileUrl;
        if (patch.status != undefined) {
            if (!CONTRACT_STATUSES.includes(patch.status)) throw new EmployeeSubResourceInvalidError(`Invalid contract status: ${patch.status}`);
            this._status = patch.status;
        }
    }
}
