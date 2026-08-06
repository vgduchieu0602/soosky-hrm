import { BankTransferColumn } from "@modules/setting/core/domain/entities/BankTransferProfile";

/** Dạng document lưu trữ của aggregate `BankTransferProfile`. */
export default interface BankTransferProfileDocument {
    _id:           string;
    code:          string;
    bankName:      string;
    description:   string | null;
    delimiter:     string;
    includeHeader: boolean;
    utf8Bom:       boolean;
    amountFormat:  string;
    dateFormat:    string;
    columns:       BankTransferColumn[];
    isActive:      boolean;
    createdAt:     Date;
    updatedAt:     Date;
}
