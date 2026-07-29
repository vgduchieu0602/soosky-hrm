import Account from "@modules/auth/core/domain/entities/Account";

/**
 * Thân response cho các endpoint đọc account (me, danh sách): không bao giờ
 * lộ passwordHash — chỉ các trường hồ sơ và trạng thái vòng đời.
 */
export interface AccountDTO {
    id:         string;
    email:      string;
    fullName:   string;
    role:       string;
    status:     string;
    verifiedAt: string | null;
    createdAt:  string;
}

const AccountPresenter = {
    toDTO(account: Account): AccountDTO {
        return {
            id:         account.id,
            email:      account.email.value,
            fullName:   account.fullName.value,
            role:       account.role.value,
            status:     account.status,
            verifiedAt: account.verifiedAt?.toISOString() ?? null,
            createdAt:  account.createdAt.toISOString(),
        };
    },
};

export default AccountPresenter;
