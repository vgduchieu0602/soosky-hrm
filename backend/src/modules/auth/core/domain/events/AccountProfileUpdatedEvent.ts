import Account from "@modules/auth/core/domain/entities/Account";
import { AccountEventType } from "@modules/auth/core/domain/events/AccountEventType";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Hồ sơ account (email, họ tên) vừa thay đổi — consumer dùng để làm mới bản
 * chiếu user phía module mình.
 */
export class AccountProfileUpdatedEvent extends DomainEvent {

    public constructor(account: Account) {
        super(AccountEventType.PROFILE_UPDATED, new Date(), {
            accountId: account.id,
            email:     account.email.value,
            fullName:  account.fullName.value,
        });
    }
}
