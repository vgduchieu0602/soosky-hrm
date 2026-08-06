import BankTransferProfileInvalidError from "@modules/setting/core/domain/errors/BankTransferProfileInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

/**
 * Nguồn dữ liệu cho một cột của file chuyển lương.
 *
 * Danh sách này là HỢP ĐỒNG giữa Setting (nơi cấu hình) và Payroll (nơi sinh
 * file). Thêm giá trị mới ở đây thì phải xử lý nó trong
 * `ExportBankTransferFileUseCase`, nếu không cột sẽ ra rỗng.
 */
export const BANK_COLUMN_SOURCES = [
    "sequence",             // số thứ tự dòng, bắt đầu từ 1
    "employee_code",
    "employee_name",
    "bank_account_number",
    "bank_account_holder",
    "bank_name",
    "bank_branch",
    "net_salary",
    "period_name",
    "pay_date",
    "static",               // giá trị cố định, lấy từ `staticValue`
] as const;
export type BankColumnSource = (typeof BANK_COLUMN_SOURCES)[number];

export const BANK_DELIMITERS = [",", ";", "\t", "|"] as const;
export type BankDelimiter = (typeof BANK_DELIMITERS)[number];

/** Định dạng số tiền trong file. Ngân hàng VN thường yêu cầu số nguyên không phân cách. */
export const BANK_AMOUNT_FORMATS = ["plain", "grouped"] as const;
export type BankAmountFormat = (typeof BANK_AMOUNT_FORMATS)[number];

export interface BankTransferColumn {
    /** Tiêu đề cột trong file (chỉ dùng khi `includeHeader`). */
    header:       string;
    source:       BankColumnSource;
    /** Chỉ dùng khi `source === "static"`. */
    staticValue?: string | null;
}

export interface BankTransferProfileProps {
    id:            string;
    /** Mã hồ sơ, viết hoa, duy nhất — vd `VCB`, `ACB-BULK`. */
    code:          string;
    bankName:      string;
    description:   string | null;
    delimiter:     BankDelimiter;
    includeHeader: boolean;
    /** `true` = ghi BOM UTF-8; nhiều cổng ngân hàng đọc sai tiếng Việt nếu thiếu. */
    utf8Bom:       boolean;
    amountFormat:  BankAmountFormat;
    /** Ngày định dạng theo mẫu ngân hàng: `dd/MM/yyyy` hoặc `yyyy-MM-dd`. */
    dateFormat:    string;
    columns:       BankTransferColumn[];
    isActive:      boolean;
    createdAt:     Date;
    updatedAt:     Date;
}

export type BankTransferProfileCreationInput = Omit<BankTransferProfileProps,
    "isActive" | "createdAt" | "updatedAt">;

export interface BankTransferProfileUpdateInput {
    bankName?:      string;
    description?:   string | null;
    delimiter?:     BankDelimiter;
    includeHeader?: boolean;
    utf8Bom?:       boolean;
    amountFormat?:  BankAmountFormat;
    dateFormat?:    string;
    columns?:       BankTransferColumn[];
}

const CODE_PATTERN      = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
const MAX_COLUMNS       = 30;
const SUPPORTED_DATE_FORMATS = ["dd/MM/yyyy", "yyyy-MM-dd", "ddMMyyyy"] as const;

/**
 * Mẫu file chuyển lương của MỘT ngân hàng, do Admin/HR tự cấu hình.
 *
 * Vì sao cấu hình thay vì hard-code: mỗi ngân hàng một định dạng, và doanh
 * nghiệp đổi ngân hàng không phải là lý do để sửa code. Payroll chỉ biết "có
 * một hồ sơ đang bật" và sinh file theo mô tả cột trong đó.
 *
 * Đúng MỘT hồ sơ được `isActive` tại một thời điểm — file chuyển lương phải
 * không mơ hồ về việc nó nộp cho ngân hàng nào (bật hồ sơ khác là việc của
 * use-case `ActivateBankTransferProfileUseCase`).
 */
export default class BankTransferProfile extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly code: string,
        public readonly createdAt: Date,
        private _bankName: string,
        private _description: string | null,
        private _delimiter: BankDelimiter,
        private _includeHeader: boolean,
        private _utf8Bom: boolean,
        private _amountFormat: BankAmountFormat,
        private _dateFormat: string,
        private _columns: BankTransferColumn[],
        private _isActive: boolean,
        private _updatedAt: Date,
    ) {
        super();
    }

    get bankName(): string { return this._bankName; }
    get description(): string | null { return this._description; }
    get delimiter(): BankDelimiter { return this._delimiter; }
    get includeHeader(): boolean { return this._includeHeader; }
    get utf8Bom(): boolean { return this._utf8Bom; }
    get amountFormat(): BankAmountFormat { return this._amountFormat; }
    get dateFormat(): string { return this._dateFormat; }
    get columns(): readonly BankTransferColumn[] { return this._columns.map(column => ({ ...column })); }
    get isActive(): boolean { return this._isActive; }
    get updatedAt(): Date { return this._updatedAt; }

    static create(input: BankTransferProfileCreationInput): BankTransferProfile {
        const now = new Date();
        return BankTransferProfile.rehydrate({
            ...input, isActive: false, createdAt: now, updatedAt: now,
        });
    }

    static rehydrate(props: BankTransferProfileProps): BankTransferProfile {
        const code = props.code.trim().toUpperCase();
        if (!CODE_PATTERN.test(code)) {
            throw new BankTransferProfileInvalidError("Code must be 2-20 chars: A-Z, 0-9, hyphen");
        }

        const bankName = props.bankName.trim();
        if (bankName.length === 0) throw new BankTransferProfileInvalidError("Bank name must not be empty");

        return new BankTransferProfile(
            props.id, code, props.createdAt,
            bankName,
            props.description?.trim() || null,
            props.delimiter, props.includeHeader, props.utf8Bom, props.amountFormat,
            validateDateFormat(props.dateFormat),
            validateColumns(props.columns),
            props.isActive, props.updatedAt,
        );
    }

    /**
     * @throws {BankTransferProfileInvalidError} Cột/định dạng ngày không hợp lệ.
     */
    update(patch: BankTransferProfileUpdateInput): void {
        if (patch.bankName != undefined) {
            const bankName = patch.bankName.trim();
            if (bankName.length === 0) throw new BankTransferProfileInvalidError("Bank name must not be empty");
            this._bankName = bankName;
        }
        if (patch.description !== undefined)   this._description = patch.description?.trim() || null;
        if (patch.delimiter != undefined)      this._delimiter = patch.delimiter;
        if (patch.includeHeader != undefined)  this._includeHeader = patch.includeHeader;
        if (patch.utf8Bom != undefined)        this._utf8Bom = patch.utf8Bom;
        if (patch.amountFormat != undefined)   this._amountFormat = patch.amountFormat;
        if (patch.dateFormat != undefined)     this._dateFormat = validateDateFormat(patch.dateFormat);
        if (patch.columns != undefined)        this._columns = validateColumns(patch.columns);

        this._updatedAt = new Date();
    }

    activate(): void {
        this._isActive  = true;
        this._updatedAt = new Date();
    }

    deactivate(): void {
        this._isActive  = false;
        this._updatedAt = new Date();
    }
}

function validateDateFormat(raw: string): string {
    if (!(SUPPORTED_DATE_FORMATS as readonly string[]).includes(raw)) {
        throw new BankTransferProfileInvalidError(`dateFormat must be one of: ${SUPPORTED_DATE_FORMATS.join(", ")}`);
    }
    return raw;
}

function validateColumns(raw: BankTransferColumn[]): BankTransferColumn[] {
    if (raw.length === 0) throw new BankTransferProfileInvalidError("Profile must define at least one column");
    if (raw.length > MAX_COLUMNS) {
        throw new BankTransferProfileInvalidError(`Profile must define at most ${MAX_COLUMNS} columns`);
    }

    const columns = raw.map((column) => {
        const header = column.header.trim();
        if (header.length === 0) throw new BankTransferProfileInvalidError("Column header must not be empty");

        if (!(BANK_COLUMN_SOURCES as readonly string[]).includes(column.source)) {
            throw new BankTransferProfileInvalidError(`Unknown column source: ${column.source}`);
        }
        // Cột `static` không có giá trị thì là cột rỗng vô nghĩa — chặn từ lúc cấu hình
        // thay vì để phát hiện lúc ngân hàng từ chối file.
        if (column.source === "static" && (column.staticValue ?? "").trim().length === 0) {
            throw new BankTransferProfileInvalidError(`Column '${header}' uses source 'static' but has no staticValue`);
        }

        return {
            header,
            source: column.source,
            staticValue: column.source === "static" ? (column.staticValue ?? "").trim() : null,
        };
    });

    // Thiếu số tài khoản hoặc số tiền thì file không dùng được để chuyển khoản.
    const sources = columns.map(column => column.source);
    for (const required of ["bank_account_number", "net_salary"] as const) {
        if (!sources.includes(required)) {
            throw new BankTransferProfileInvalidError(`Profile must include a '${required}' column`);
        }
    }

    return columns;
}
