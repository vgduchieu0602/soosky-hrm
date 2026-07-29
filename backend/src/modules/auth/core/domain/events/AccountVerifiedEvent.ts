import Account from "@modules/auth/core/domain/entities/Account";
import { AccountEventType } from "@modules/auth/core/domain/events/AccountEventType";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Account vừa được xác minh email lần đầu — consumer dùng để tạo bản chiếu
 * user phía module mình.
 */
export class AccountVerifiedEvent extends DomainEvent {

    public constructor(account: Account) {
        super(AccountEventType.VERIFIED, new Date(), {
            accountId: account.id,
            email:     account.email.value,
            fullName:  account.fullName.value,
        });
    }
}
