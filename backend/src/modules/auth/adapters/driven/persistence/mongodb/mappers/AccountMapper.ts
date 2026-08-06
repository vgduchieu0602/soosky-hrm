import AccountDocument from "@modules/auth/adapters/driven/persistence/mongodb/documents/AccountDocument";
import Account, { AccountStatus } from "@modules/auth/core/domain/entities/Account";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import FullName from "@modules/auth/core/domain/value-objects/FullName";
import Email from "@shared/core/domain/value-objects/email/Email";

const AccountMapper = {
    toDocument(account: Account): AccountDocument {
        return {
            _id:          account.id,
            email:        account.email.value,
            passwordHash: account.passwordHash,
            fullName:     account.fullName.value,
            role:         account.role.value,
            status:       account.status,
            verifiedAt:   account.verifiedAt,
            createdAt:    account.createdAt,
            mustChangePassword: account.mustChangePassword,
        };
    },

    toDomain(document: AccountDocument): Account {
        return Account.rehydrate({
            id:           document._id,
            email:        Email.create(document.email),
            passwordHash: document.passwordHash,
            fullName:     FullName.create(document.fullName),
            role:         AccountRole.fromValue(document.role),
            status:       document.status as AccountStatus,
            verifiedAt:   document.verifiedAt,
            createdAt:    document.createdAt,
            mustChangePassword: document.mustChangePassword ?? false,
        });
    },
};

export default AccountMapper;
