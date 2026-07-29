import EmployeeSubResourceInvalidError from "@modules/employee/core/domain/errors/EmployeeSubResourceInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const RELATIONSHIPS = ["spouse", "parent", "sibling", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export interface EmployeeContactProps {
    id:           string;
    employeeId:   string;
    name:         string;
    relationship: Relationship;
    phone:        string | null;
    email:        string | null;
    address:      string | null;
    isPrimary:    boolean;
    createdAt:    Date;
}

/** Người liên hệ khẩn cấp của nhân viên — nhiều bản ghi trên một nhân viên. */
export default class EmployeeContact extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly createdAt: Date,
        private _name: string,
        private _relationship: Relationship,
        private _phone: string | null,
        private _email: string | null,
        private _address: string | null,
        private _isPrimary: boolean,
    ) {
        super();
    }

    get name(): string { return this._name; }
    get relationship(): Relationship { return this._relationship; }
    get phone(): string | null { return this._phone; }
    get email(): string | null { return this._email; }
    get address(): string | null { return this._address; }
    get isPrimary(): boolean { return this._isPrimary; }

    static create(props: Omit<EmployeeContactProps, "createdAt">): EmployeeContact {
        return EmployeeContact.rehydrate({ ...props, createdAt: new Date() });
    }

    static rehydrate(props: EmployeeContactProps): EmployeeContact {
        if (props.name.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Contact name must not be empty");
        }
        if (!RELATIONSHIPS.includes(props.relationship)) {
            throw new EmployeeSubResourceInvalidError(`Invalid contact relationship: ${props.relationship}`);
        }
        return new EmployeeContact(
            props.id, props.employeeId, props.createdAt,
            props.name.trim(), props.relationship, props.phone, props.email, props.address, props.isPrimary,
        );
    }

    update(patch: { name?: string | undefined; relationship?: Relationship | undefined; phone?: string | null | undefined; email?: string | null | undefined; address?: string | null | undefined; isPrimary?: boolean | undefined; }): void {
        if (patch.name != undefined) {
            if (patch.name.trim().length === 0) throw new EmployeeSubResourceInvalidError("Contact name must not be empty");
            this._name = patch.name.trim();
        }
        if (patch.relationship != undefined) {
            if (!RELATIONSHIPS.includes(patch.relationship)) throw new EmployeeSubResourceInvalidError(`Invalid contact relationship: ${patch.relationship}`);
            this._relationship = patch.relationship;
        }
        if (patch.phone !== undefined)     this._phone = patch.phone;
        if (patch.email !== undefined)     this._email = patch.email;
        if (patch.address !== undefined)   this._address = patch.address;
        if (patch.isPrimary !== undefined) this._isPrimary = patch.isPrimary;
    }
}
