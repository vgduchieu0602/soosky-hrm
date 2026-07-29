import { AccountEventType } from "@modules/auth/core/domain/events/AccountEventType";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Account vừa bị vô hiệu hoá.
 */
export class AccountDeactivatedEvent extends DomainEvent {

    public constructor(accountId: string) {
        super(AccountEventType.DEACTIVATED, new Date(), {
            accountId: accountId
        });
    }
}
