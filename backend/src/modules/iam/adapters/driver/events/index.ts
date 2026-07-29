import AccountDeactivatedEventHandler from "@modules/iam/adapters/driver/events/AccountDeactivatedEventHandler";
import AccountProfileUpdatedEventHandler from "@modules/iam/adapters/driver/events/AccountProfileUpdatedEventHandler";
import AccountReactivatedEventHandler from "@modules/iam/adapters/driver/events/AccountReactivatedEventHandler";
import AccountRoleChangedEventHandler from "@modules/iam/adapters/driver/events/AccountRoleChangedEventHandler";
import AccountVerifiedEventHandler from "@modules/iam/adapters/driver/events/AccountVerifiedEventHandler";
import DeactivateUserProjectionUseCase from "@modules/iam/core/app/use-cases/projection/DeactivateUserProjectionUseCase";
import ProjectUserFromAccountUseCase from "@modules/iam/core/app/use-cases/projection/ProjectUserFromAccountUseCase";
import ReactivateUserProjectionUseCase from "@modules/iam/core/app/use-cases/projection/ReactivateUserProjectionUseCase";
import SyncUserProfileUseCase from "@modules/iam/core/app/use-cases/projection/SyncUserProfileUseCase";
import EventBus from "@shared/core/domain/EventBus";

/**
 * Toàn bộ use-case mà driver adapter events cần để tiêu thụ sự kiện tích hợp
 * của module Auth.
 */
export interface IamEventUseCases {
    projectUserFromAccount:    ProjectUserFromAccountUseCase;
    syncUserProfile:           SyncUserProfileUseCase;
    deactivateUserProjection:  DeactivateUserProjectionUseCase;
    reactivateUserProjection:  ReactivateUserProjectionUseCase;
}

/**
 * Đăng ký toàn bộ event handler tiêu thụ sự kiện account của module Auth vào
 * `EventBus` — điểm nối dây duy nhất giữa Auth (publisher) và IAM (consumer).
 */
export function subscribeIamEventConsumer(eventBus: EventBus, useCases: IamEventUseCases): void {
    const handlers = [
        new AccountVerifiedEventHandler(useCases.projectUserFromAccount),
        new AccountProfileUpdatedEventHandler(useCases.syncUserProfile),
        new AccountDeactivatedEventHandler(useCases.deactivateUserProjection),
        new AccountReactivatedEventHandler(useCases.reactivateUserProjection),
        new AccountRoleChangedEventHandler(),
    ];

    for (const handler of handlers) {
        eventBus.subscribe(handler.eventType, handler.handle);
    }
}
