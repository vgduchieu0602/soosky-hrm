import EmployeeSubResourceInvalidError from "@modules/employee/core/domain/errors/EmployeeSubResourceInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface EmployeeBankAccountProps {
    id:            string;
    employeeId:    string;
    bankName:      string;
    branch:        string | null;
    accountNumber: string;
    accountHolder: string;
    isPrimary:     boolean;
    createdAt:     Date;
}

/** Tài khoản ngân hàng của nhân viên — nhiều bản ghi trên một nhân viên. */
export default class EmployeeBankAccount extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly createdAt: Date,
        private _bankName: string,
        private _branch: string | null,
        private _accountNumber: string,
        private _accountHolder: string,
        private _isPrimary: boolean,
    ) {
        super();
    }

    get bankName(): string { return this._bankName; }
    get branch(): string | null { return this._branch; }
    get accountNumber(): string { return this._accountNumber; }
    get accountHolder(): string { return this._accountHolder; }
    get isPrimary(): boolean { return this._isPrimary; }

    static create(props: Omit<EmployeeBankAccountProps, "createdAt">): EmployeeBankAccount {
        return EmployeeBankAccount.rehydrate({ ...props, createdAt: new Date() });
    }

    static rehydrate(props: EmployeeBankAccountProps): EmployeeBankAccount {
        if (props.bankName.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Bank name must not be empty");
        }
        if (props.accountNumber.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Account number must not be empty");
        }
        if (props.accountHolder.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Account holder must not be empty");
        }
        return new EmployeeBankAccount(
            props.id, props.employeeId, props.createdAt,
            props.bankName.trim(), props.branch, props.accountNumber.trim(), props.accountHolder.trim(), props.isPrimary,
        );
    }

    update(patch: { bankName?: string | undefined; branch?: string | null | undefined; accountNumber?: string | undefined; accountHolder?: string | undefined; isPrimary?: boolean | undefined; }): void {
        if (patch.bankName != undefined) {
            if (patch.bankName.trim().length === 0) throw new EmployeeSubResourceInvalidError("Bank name must not be empty");
            this._bankName = patch.bankName.trim();
        }
        if (patch.branch !== undefined) this._branch = patch.branch;
        if (patch.accountNumber != undefined) {
            if (patch.accountNumber.trim().length === 0) throw new EmployeeSubResourceInvalidError("Account number must not be empty");
            this._accountNumber = patch.accountNumber.trim();
        }
        if (patch.accountHolder != undefined) {
            if (patch.accountHolder.trim().length === 0) throw new EmployeeSubResourceInvalidError("Account holder must not be empty");
            this._accountHolder = patch.accountHolder.trim();
        }
        if (patch.isPrimary !== undefined) this._isPrimary = patch.isPrimary;
    }
}
