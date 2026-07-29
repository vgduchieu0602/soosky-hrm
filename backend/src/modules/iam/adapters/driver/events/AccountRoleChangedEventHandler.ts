import { AuthAccountEventType } from "@modules/iam/adapters/driver/events/AuthAccountEventType";
import DomainEventHandler from "@shared/adapters/driver/events/DomainEventHandler";
import DomainEvent from "@shared/core/domain/DomainEvent";

/**
 * Tiêu thụ `auth.account.role-changed`.
 *
 * Không hành động: role hệ thống của Auth (member/admin/owner) là một khái
 * niệm khác với role RBAC của IAM (`iam_roles`) — quyền hạn trong IAM chỉ do
 * `AssignRoleToUserUseCase`/`RevokeRoleFromUserUseCase` quyết định. Handler
 * vẫn được đăng ký để không bỏ sót sự kiện và giữ chỗ nếu logic tương lai
 * cần phản ứng với thay đổi role phía Auth.
 */
export default class AccountRoleChangedEventHandler implements DomainEventHandler {
    public readonly eventType = AuthAccountEventType.ROLE_CHANGED;

    public handle = async (_event: DomainEvent): Promise<void> => {
        // no-op
    };
}
