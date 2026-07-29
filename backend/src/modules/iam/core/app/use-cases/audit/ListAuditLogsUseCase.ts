import AuditRepo from "@modules/iam/core/app/ports/AuditRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface ListAuditLogsInput {
    actorUserId: string;
    resource?:   string;
    resourceId?: string;
}

/**
 * Liệt kê audit log, tuỳ chọn lọc theo resource/resourceId.
 */
export default class ListAuditLogsUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _auditRepo: AuditRepo,
    ) {}

    /**
     * @param input.actorUserId Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.resource    Lọc theo loại tài nguyên (tuỳ chọn).
     * @param input.resourceId  Lọc theo id tài nguyên (tuỳ chọn).
     *
     * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
     */
    public async execute(input: ListAuditLogsInput): Promise<AuditLog[]> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        return this._auditRepo.list({
            ...(input.resource != undefined ? { resource: input.resource } : {}),
            ...(input.resourceId != undefined ? { resourceId: input.resourceId } : {}),
        });
    }
}
