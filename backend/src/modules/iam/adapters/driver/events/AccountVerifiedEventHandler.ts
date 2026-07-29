import { AuthAccountEventType, AuthAccountVerifiedPayload } from "@modules/iam/adapters/driver/events/AuthAccountEventType";
import ProjectUserFromAccountUseCase from "@modules/iam/core/app/use-cases/projection/ProjectUserFromAccountUseCase";
import DomainEventHandler from "@shared/adapters/driver/events/DomainEventHandler";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Tiêu thụ `auth.account.verified`: tạo bản chiếu `User` phía IAM.
 *
 * Payload của Auth mang sẵn `email`/`fullName` (xem `AccountVerifiedEvent`
 * bên module Auth) nên dùng thẳng, không cần truy vấn ngược lại Auth.
 */
export default class AccountVerifiedEventHandler implements DomainEventHandler {
    public readonly eventType = AuthAccountEventType.VERIFIED;

    public constructor(
        private readonly _projectUserFromAccount: ProjectUserFromAccountUseCase,
    ) {}

    public handle = async (event: DomainEvent): Promise<void> => {
        const payload = event.payload as unknown as AuthAccountVerifiedPayload;

        await this._projectUserFromAccount.execute({
            accountId:   payload.accountId,
            displayName: payload.fullName,
            email:       payload.email,
        });
    };
}
