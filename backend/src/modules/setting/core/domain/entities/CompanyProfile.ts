import CompanyProfileInvalidError from "@modules/setting/core/domain/errors/CompanyProfileInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

/** Id cố định — luôn tồn tại đúng một document `CompanyProfile`. */
export const COMPANY_PROFILE_ID = "global";

export const DEFAULT_TIMEZONE                  = "Asia/Ho_Chi_Minh";
export const DEFAULT_CURRENCY                  = "VND";
export const DEFAULT_STANDARD_WORK_HOURS_PER_DAY   = 8;
export const DEFAULT_STANDARD_WORK_DAYS_PER_MONTH  = 22;

const NAME_MAX_LENGTH     = 160;
const TIMEZONE_MAX_LENGTH = 64;

export interface CompanyProfileProps {
    id:                        string;
    name:                      string;
    address:                   string | null;
    taxCode:                   string | null;
    phone:                     string | null;
    email:                     string | null;
    logoUrl:                   string | null;
    timezone:                  string;
    currency:                  string;
    standardWorkHoursPerDay:   number;
    standardWorkDaysPerMonth:  number;
    createdAt:                 Date;
    updatedAt:                 Date;
}

export type CompanyProfilePatch = Partial<Omit<CompanyProfileProps, "id" | "createdAt" | "updatedAt">>;

/**
 * Hồ sơ công ty — singleton (id cố định `{@link COMPANY_PROFILE_ID}`, luôn
 * tồn tại đúng một document). Gộp thông tin định danh công ty (tên, địa chỉ,
 * mã số thuế, liên hệ, logo) và cấu hình làm việc chung (múi giờ, đơn vị
 * tiền tệ, giờ/ngày công chuẩn).
 */
export default class CompanyProfile extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _updatedAt: Date,
        private _name: string,
        private _address: string | null,
        private _taxCode: string | null,
        private _phone: string | null,
        private _email: string | null,
        private _logoUrl: string | null,
        private _timezone: string,
        private _currency: string,
        private _standardWorkHoursPerDay: number,
        private _standardWorkDaysPerMonth: number,
    ) {
        super();
    }

    get name(): string { return this._name; }
    get address(): string | null { return this._address; }
    get taxCode(): string | null { return this._taxCode; }
    get phone(): string | null { return this._phone; }
    get email(): string | null { return this._email; }
    get logoUrl(): string | null { return this._logoUrl; }
    get timezone(): string { return this._timezone; }
    get currency(): string { return this._currency; }
    get standardWorkHoursPerDay(): number { return this._standardWorkHoursPerDay; }
    get standardWorkDaysPerMonth(): number { return this._standardWorkDaysPerMonth; }
    get updatedAt(): Date { return this._updatedAt; }

    static create(props: Omit<CompanyProfileProps, "id" | "createdAt" | "updatedAt">): CompanyProfile {
        const now = new Date();
        return CompanyProfile.rehydrate({ ...props, id: COMPANY_PROFILE_ID, createdAt: now, updatedAt: now });
    }

    static rehydrate(props: CompanyProfileProps): CompanyProfile {
        const name = validateName(props.name);
        const timezone = validateTimezone(props.timezone);
        const currency = validateCurrency(props.currency);
        const standardWorkHoursPerDay = validateStandardWorkHoursPerDay(props.standardWorkHoursPerDay);
        const standardWorkDaysPerMonth = validateStandardWorkDaysPerMonth(props.standardWorkDaysPerMonth);

        return new CompanyProfile(
            props.id,
            props.createdAt,
            props.updatedAt,
            name,
            props.address,
            props.taxCode,
            props.phone,
            props.email,
            props.logoUrl,
            timezone,
            currency,
            standardWorkHoursPerDay,
            standardWorkDaysPerMonth,
        );
    }

    update(patch: CompanyProfilePatch): void {
        if (patch.name != undefined)                     this._name = validateName(patch.name);
        if (patch.address !== undefined)                  this._address = patch.address;
        if (patch.taxCode !== undefined)                  this._taxCode = patch.taxCode;
        if (patch.phone !== undefined)                    this._phone = patch.phone;
        if (patch.email !== undefined)                    this._email = patch.email;
        if (patch.logoUrl !== undefined)                  this._logoUrl = patch.logoUrl;
        if (patch.timezone != undefined)                  this._timezone = validateTimezone(patch.timezone);
        if (patch.currency != undefined)                  this._currency = validateCurrency(patch.currency);
        if (patch.standardWorkHoursPerDay != undefined)   this._standardWorkHoursPerDay = validateStandardWorkHoursPerDay(patch.standardWorkHoursPerDay);
        if (patch.standardWorkDaysPerMonth != undefined)  this._standardWorkDaysPerMonth = validateStandardWorkDaysPerMonth(patch.standardWorkDaysPerMonth);
        this._updatedAt = new Date();
    }
}

function validateName(raw: string): string {
    const name = raw.trim();
    if (name.length === 0) {
        throw new CompanyProfileInvalidError("Company name must not be empty");
    }
    if (name.length > NAME_MAX_LENGTH) {
        throw new CompanyProfileInvalidError(`Company name must be at most ${NAME_MAX_LENGTH} characters`);
    }
    return name;
}

function validateTimezone(raw: string): string {
    const timezone = raw.trim();
    if (timezone.length === 0) {
        throw new CompanyProfileInvalidError("Timezone must not be empty");
    }
    if (timezone.length > TIMEZONE_MAX_LENGTH) {
        throw new CompanyProfileInvalidError(`Timezone must be at most ${TIMEZONE_MAX_LENGTH} characters`);
    }
    return timezone;
}

function validateCurrency(raw: string): string {
    const currency = raw.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(currency) === false) {
        throw new CompanyProfileInvalidError("Currency must be a 3-letter ISO code (e.g. VND, USD)");
    }
    return currency;
}

function validateStandardWorkHoursPerDay(raw: number): number {
    if (Number.isInteger(raw) === false || raw < 1 || raw > 24) {
        throw new CompanyProfileInvalidError("Standard work hours per day must be an integer between 1 and 24");
    }
    return raw;
}

function validateStandardWorkDaysPerMonth(raw: number): number {
    if (Number.isInteger(raw) === false || raw < 1 || raw > 31) {
        throw new CompanyProfileInvalidError("Standard work days per month must be an integer between 1 and 31");
    }
    return raw;
}
