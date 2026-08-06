import BankTransferProfile from "@modules/setting/core/domain/entities/BankTransferProfile";

export interface BankTransferProfileDTO {
    id:            string;
    code:          string;
    bankName:      string;
    description:   string | null;
    delimiter:     string;
    includeHeader: boolean;
    utf8Bom:       boolean;
    amountFormat:  string;
    dateFormat:    string;
    columns:       { header: string; source: string; staticValue: string | null }[];
    isActive:      boolean;
    createdAt:     string;
    updatedAt:     string;
}

const BankTransferProfilePresenter = {
    toDTO(profile: BankTransferProfile): BankTransferProfileDTO {
        return {
            id:            profile.id,
            code:          profile.code,
            bankName:      profile.bankName,
            description:   profile.description,
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
            isActive:      profile.isActive,
            createdAt:     profile.createdAt.toISOString(),
            updatedAt:     profile.updatedAt.toISOString(),
        };
    },
};

export default BankTransferProfilePresenter;
