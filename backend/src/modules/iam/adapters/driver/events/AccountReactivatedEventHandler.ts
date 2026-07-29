import { AuthAccountEventType, AuthAccountReactivatedPayload } from "@modules/iam/adapters/driver/events/AuthAccountEventType";
import ReactivateUserProjectionUseCase from "@modules/iam/core/app/use-cases/projection/ReactivateUserProjectionUseCase";
import DomainEventHandler from "@shared/adapters/driver/events/DomainEventHandler";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Tiêu thụ `auth.account.reactivated`: khôi phục bản chiếu `User` phía IAM.
 */
export default class AccountReactivatedEventHandler implements DomainEventHandler {
    public readonly eventType = AuthAccountEventType.REACTIVATED;

    public constructor(
        private readonly _reactivateUserProjection: ReactivateUserProjectionUseCase,
    ) {}

    public handle = async (event: DomainEvent): Promise<void> => {
        const payload = event.payload as unknown as AuthAccountReactivatedPayload;

        await this._reactivateUserProjection.execute({ accountId: payload.accountId });
    };
}
