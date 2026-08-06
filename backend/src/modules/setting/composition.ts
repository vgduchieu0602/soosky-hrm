import { MongoBankTransferProfileRepo, MongoCompanyProfileRepo } from "@modules/setting/adapters/driven/persistence/mongodb";
import { DEFAULT_TIMEZONE } from "@modules/setting/core/domain/entities/CompanyProfile";
import { Db as MongoDb } from "mongodb";

/**
 * Bề mặt cấu hình công ty mà module khác (Attendance) được phép tiêu thụ, KHÔNG
 * cần import repo Mongo nội bộ của Setting.
 */
export interface CompanyCalendar {
    /** Timezone IANA của doanh nghiệp. */
    timezone(): Promise<string>;
}

/**
 * Lắp `CompanyCalendar` trên nền MongoDB.
 *
 * Chưa cấu hình công ty thì trả timezone MẶC ĐỊNH thay vì lỗi: hệ thống mới
 * dựng phải chấm công được ngay, và mặc định trùng đúng giá trị mà
 * `CompanyProfile` dùng nên không có hai nguồn sự thật.
 */
/** Một cột của mẫu file chuyển lương, dưới dạng module Payroll nhìn thấy. */
export interface BankTransferColumnView {
    header:      string;
    source:      string;
    staticValue: string | null;
}

/** Mẫu file chuyển lương đang bật, dưới dạng module Payroll nhìn thấy. */
export interface BankTransferProfileView {
    code:          string;
    bankName:      string;
    delimiter:     string;
    includeHeader: boolean;
    utf8Bom:       boolean;
    amountFormat:  string;
    dateFormat:    string;
    columns:       BankTransferColumnView[];
}

/**
 * Bề mặt cấu hình ngân hàng mà Payroll được phép tiêu thụ.
 *
 * Trả `undefined` khi chưa cấu hình — Payroll tự quyết định báo lỗi gì cho người
 * dùng, Setting không giả định hộ.
 */
export interface BankTransferProfileDirectory {
    activeProfile(): Promise<BankTransferProfileView | undefined>;
}

/** Lắp `BankTransferProfileDirectory` trên nền MongoDB. */
export function createBankTransferProfileDirectory(mongoDb: MongoDb): BankTransferProfileDirectory {
    const bankProfileRepo = new MongoBankTransferProfileRepo(mongoDb);

    return {
        activeProfile: async () => {
            const profile = await bankProfileRepo.findActive();
            if (profile == undefined) return undefined;

            return {
                code:          profile.code,
                bankName:      profile.bankName,
                delimiter:     profile.delimiter,
                includeHeader: profile.includeHeader,
                utf8Bom:       profile.utf8Bom,
                amountFormat:  profile.amountFormat,
                dateFormat:    profile.dateFormat,
                columns:       profile.columns.map(column => ({
                    header:      column.header,
                    source:      column.source,
                    staticValue: column.staticValue ?? null,
                })),
            };
        },
    };
}

export function createCompanyCalendar(mongoDb: MongoDb): CompanyCalendar {
    const companyProfileRepo = new MongoCompanyProfileRepo(mongoDb);

    return {
        timezone: async () => (await companyProfileRepo.get())?.timezone ?? DEFAULT_TIMEZONE,
    };
}
