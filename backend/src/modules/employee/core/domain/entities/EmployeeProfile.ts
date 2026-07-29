import EmployeeSubResourceInvalidError from "@modules/employee/core/domain/errors/EmployeeSubResourceInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export interface EmployeeProfileProps {
    id:                string;
    employeeId:        string;
    firstName:         string;
    lastName:           string;
    middleName:        string | null;
    dateOfBirth:       Date | null;
    gender:            string | null;
    nationality:       string | null;
    maritalStatus:     string | null;
    avatarUrl:         string | null;
    personalEmail:     string | null;
    workEmail:         string | null;
    phone:             string | null;
    address:           string | null;
    socialInsuranceNo: string | null;
    taxCode:           string | null;
    vehiclePlate:      string | null;
    createdAt:         Date;
}

/** Hồ sơ chi tiết 1-1 của một nhân viên (thông tin cá nhân). */
export default class EmployeeProfile extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly createdAt: Date,
        private _firstName: string,
        private _lastName: string,
        private _middleName: string | null,
        private _dateOfBirth: Date | null,
        private _gender: string | null,
        private _nationality: string | null,
        private _maritalStatus: string | null,
        private _avatarUrl: string | null,
        private _personalEmail: string | null,
        private _workEmail: string | null,
        private _phone: string | null,
        private _address: string | null,
        private _socialInsuranceNo: string | null,
        private _taxCode: string | null,
        private _vehiclePlate: string | null,
    ) {
        super();
    }

    get firstName(): string { return this._firstName; }
    get lastName(): string { return this._lastName; }
    get middleName(): string | null { return this._middleName; }
    get dateOfBirth(): Date | null { return this._dateOfBirth; }
    get gender(): string | null { return this._gender; }
    get nationality(): string | null { return this._nationality; }
    get maritalStatus(): string | null { return this._maritalStatus; }
    get avatarUrl(): string | null { return this._avatarUrl; }
    get personalEmail(): string | null { return this._personalEmail; }
    get workEmail(): string | null { return this._workEmail; }
    get phone(): string | null { return this._phone; }
    get address(): string | null { return this._address; }
    get socialInsuranceNo(): string | null { return this._socialInsuranceNo; }
    get taxCode(): string | null { return this._taxCode; }
    get vehiclePlate(): string | null { return this._vehiclePlate; }

    static create(props: Omit<EmployeeProfileProps, "createdAt">): EmployeeProfile {
        return EmployeeProfile.rehydrate({ ...props, createdAt: new Date() });
    }

    static rehydrate(props: EmployeeProfileProps): EmployeeProfile {
        if (props.firstName.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Profile firstName must not be empty");
        }
        if (props.lastName.trim().length === 0) {
            throw new EmployeeSubResourceInvalidError("Profile lastName must not be empty");
        }
        return new EmployeeProfile(
            props.id,
            props.employeeId,
            props.createdAt,
            props.firstName.trim(),
            props.lastName.trim(),
            props.middleName,
            props.dateOfBirth,
            props.gender,
            props.nationality,
            props.maritalStatus,
            props.avatarUrl,
            props.personalEmail,
            props.workEmail,
            props.phone,
            props.address,
            props.socialInsuranceNo,
            props.taxCode,
            props.vehiclePlate,
        );
    }

    update(patch: Partial<Omit<EmployeeProfileProps, "id" | "employeeId" | "createdAt">>): void {
        if (patch.firstName != undefined) {
            if (patch.firstName.trim().length === 0) throw new EmployeeSubResourceInvalidError("Profile firstName must not be empty");
            this._firstName = patch.firstName.trim();
        }
        if (patch.lastName != undefined) {
            if (patch.lastName.trim().length === 0) throw new EmployeeSubResourceInvalidError("Profile lastName must not be empty");
            this._lastName = patch.lastName.trim();
        }
        if (patch.middleName !== undefined)        this._middleName = patch.middleName;
        if (patch.dateOfBirth !== undefined)        this._dateOfBirth = patch.dateOfBirth;
        if (patch.gender !== undefined)             this._gender = patch.gender;
        if (patch.nationality !== undefined)        this._nationality = patch.nationality;
        if (patch.maritalStatus !== undefined)      this._maritalStatus = patch.maritalStatus;
        if (patch.avatarUrl !== undefined)          this._avatarUrl = patch.avatarUrl;
        if (patch.personalEmail !== undefined)      this._personalEmail = patch.personalEmail;
        if (patch.workEmail !== undefined)          this._workEmail = patch.workEmail;
        if (patch.phone !== undefined)              this._phone = patch.phone;
        if (patch.address !== undefined)            this._address = patch.address;
        if (patch.socialInsuranceNo !== undefined)  this._socialInsuranceNo = patch.socialInsuranceNo;
        if (patch.taxCode !== undefined)             this._taxCode = patch.taxCode;
        if (patch.vehiclePlate !== undefined)        this._vehiclePlate = patch.vehiclePlate;
    }
}
