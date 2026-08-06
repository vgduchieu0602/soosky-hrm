import BankTransferProfileDocument from "@modules/setting/adapters/driven/persistence/mongodb/documents/BankTransferProfileDocument";
import BankTransferProfile, { BankAmountFormat, BankDelimiter } from "@modules/setting/core/domain/entities/BankTransferProfile";

const BankTransferProfileMapper = {
    toDocument(profile: BankTransferProfile): BankTransferProfileDocument {
        return {
            _id:           profile.id,
            code:          profile.code,
            bankName:      profile.bankName,
            description:   profile.description,
            delimiter:     profile.delimiter,
            includeHeader: profile.includeHeader,
            utf8Bom:       profile.utf8Bom,
            amountFormat:  profile.amountFormat,
            dateFormat:    profile.dateFormat,
            columns:       [...profile.columns],
            isActive:      profile.isActive,
            createdAt:     profile.createdAt,
            updatedAt:     profile.updatedAt,
        };
    },

    toDomain(document: BankTransferProfileDocument): BankTransferProfile {
        return BankTransferProfile.rehydrate({
            id:            document._id,
            code:          document.code,
            bankName:      document.bankName,
            description:   document.description,
            delimiter:     document.delimiter as BankDelimiter,
            includeHeader: document.includeHeader,
            utf8Bom:       document.utf8Bom,
            amountFormat:  document.amountFormat as BankAmountFormat,
            dateFormat:    document.dateFormat,
            columns:       document.columns,
            isActive:      document.isActive,
            createdAt:     document.createdAt,
            updatedAt:     document.updatedAt,
        });
    },
};

export default BankTransferProfileMapper;
