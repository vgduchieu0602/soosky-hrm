import Account from "@modules/auth/core/domain/entities/Account";
import { AccountEventType } from "@modules/auth/core/domain/events/AccountEventType";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Role hệ thống của account vừa thay đổi — consumer dùng để cập nhật quyền
 * hạn gắn với bản chiếu user phía module mình.
 */
export class AccountRoleChangedEvent extends DomainEvent {

    public constructor(account: Account) {
        super(AccountEventType.ROLE_CHANGED, new Date(), {
            accountId: account.id,
            role:      account.role.value,
        });
    }
}
