
/**
 * Sự kiện tích hợp module Auth phát lên EventBus (published language).
 *
 * Các module khác (vd: Task Management) giữ bản sao hợp đồng này ở phía
 * consumer và chỉ nói chuyện với Auth qua EventBus — không import từ đây.
 * Đổi `type` hoặc payload là breaking change với mọi consumer.
 */
export enum AccountEventType {
    VERIFIED        = "auth.account.verified",
    PROFILE_UPDATED = "auth.account.profile-updated",
    ROLE_CHANGED    = "auth.account.role-changed",
    DEACTIVATED     = "auth.account.deactivated",
    REACTIVATED     = "auth.account.reactivated",
}
