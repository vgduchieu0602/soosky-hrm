/**
 * Bản sao cục bộ ("published language") hợp đồng sự kiện tích hợp mà module
 * Auth phát lên EventBus (xem `src/modules/auth/core/domain/events/*`).
 *
 * KHÔNG import trực tiếp từ module Auth — module IAM chỉ nói chuyện với Auth
 * qua EventBus. Đây là bản khai lại cục bộ, giữ đồng bộ thủ công với Auth khi
 * hợp đồng đổi (breaking change với mọi consumer).
 */
export enum AuthAccountEventType {
    VERIFIED        = "auth.account.verified",
    PROFILE_UPDATED = "auth.account.profile-updated",
    ROLE_CHANGED    = "auth.account.role-changed",
    DEACTIVATED     = "auth.account.deactivated",
    REACTIVATED     = "auth.account.reactivated",
}

/**
 * Payload của `auth.account.verified`.
 *
 * Giới hạn đã biết: payload của Auth hiện chỉ mang `accountId`, `email`,
 * `fullName` (không có `role`) — đủ để khởi tạo bản chiếu User, không đủ để
 * suy ra quyền hạn ban đầu (module IAM tự quyết định qua bootstrap "user đầu
 * tiên → admin", xem `ProjectUserFromAccountUseCase`).
 */
export interface AuthAccountVerifiedPayload {
    accountId: string;
    email:     string;
    fullName:  string;
}

export interface AuthAccountProfileUpdatedPayload {
    accountId: string;
    email:     string;
    fullName:  string;
}

export interface AuthAccountRoleChangedPayload {
    accountId: string;
    role:      string;
}

export interface AuthAccountDeactivatedPayload {
    accountId: string;
}

export interface AuthAccountReactivatedPayload {
    accountId: string;
}
