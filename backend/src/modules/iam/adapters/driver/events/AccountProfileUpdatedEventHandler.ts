import { AuthAccountEventType, AuthAccountProfileUpdatedPayload } from "@modules/iam/adapters/driver/events/AuthAccountEventType";
import SyncUserProfileUseCase from "@modules/iam/core/app/use-cases/projection/SyncUserProfileUseCase";
import DomainEventHandler from "@shared/adapters/driver/events/DomainEventHandler";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Tiêu thụ `auth.account.profile-updated`: đồng bộ hồ sơ hiển thị của bản
 * chiếu `User` phía IAM.
 */
export default class AccountProfileUpdatedEventHandler implements DomainEventHandler {
    public readonly eventType = AuthAccountEventType.PROFILE_UPDATED;

    public constructor(
        private readonly _syncUserProfile: SyncUserProfileUseCase,
    ) {}

    public handle = async (event: DomainEvent): Promise<void> => {
        const payload = event.payload as unknown as AuthAccountProfileUpdatedPayload;

        await this._syncUserProfile.execute({
            accountId:   payload.accountId,
            displayName: payload.fullName,
            email:       payload.email,
        });
    };
}
