import { AuthAccountDeactivatedPayload, AuthAccountEventType } from "@modules/iam/adapters/driver/events/AuthAccountEventType";
import DeactivateUserProjectionUseCase from "@modules/iam/core/app/use-cases/projection/DeactivateUserProjectionUseCase";
import DomainEventHandler from "@shared/adapters/driver/events/DomainEventHandler";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Tiêu thụ `auth.account.deactivated`: vô hiệu hoá bản chiếu `User` phía IAM.
 */
export default class AccountDeactivatedEventHandler implements DomainEventHandler {
    public readonly eventType = AuthAccountEventType.DEACTIVATED;

    public constructor(
        private readonly _deactivateUserProjection: DeactivateUserProjectionUseCase,
    ) {}

    public handle = async (event: DomainEvent): Promise<void> => {
        const payload = event.payload as unknown as AuthAccountDeactivatedPayload;

        await this._deactivateUserProjection.execute({ accountId: payload.accountId });
    };
}
