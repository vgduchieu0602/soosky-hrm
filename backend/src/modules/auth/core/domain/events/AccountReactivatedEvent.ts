import { AccountEventType } from "@modules/auth/core/domain/events/AccountEventType";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Account đã vô hiệu hoá vừa được khôi phục.
 */
export class AccountReactivatedEvent extends DomainEvent {

    public constructor(accountId: string) {
        super(AccountEventType.REACTIVATED, new Date(), {
            accountId: accountId
        });
    }
}
