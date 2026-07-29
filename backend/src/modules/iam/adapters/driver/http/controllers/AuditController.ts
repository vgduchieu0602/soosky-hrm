import AuditLogPresenter from "@modules/iam/adapters/driver/http/presenters/AuditLogPresenter";
import ListAuditLogsUseCase from "@modules/iam/core/app/use-cases/audit/ListAuditLogsUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { Request, Response } from "express";

export interface AuditControllerUseCases {
    listAuditLogs: ListAuditLogsUseCase;
}

/**
 * Controller cho endpoint nhật ký thao tác (audit log) — chỉ đọc, hỗ trợ lọc
 * theo resource/resourceId qua query string.
 */
export default class AuditController {
    public constructor(
        private readonly _useCases: AuditControllerUseCases,
    ) {}

    public listAuditLogs = async (req: Request, res: Response): Promise<void> => {
        const resource   = typeof req.query.resource === "string" ? req.query.resource : undefined;
        const resourceId = typeof req.query.resourceId === "string" ? req.query.resourceId : undefined;

        const auditLogs = await this._useCases.listAuditLogs.execute({
            actorUserId: ActorContext.get(res),
            ...(resource != undefined ? { resource } : {}),
            ...(resourceId != undefined ? { resourceId } : {}),
        });
        res.status(200).json({ auditLogs: auditLogs.map(auditLog => AuditLogPresenter.toDTO(auditLog)) });
    };
}
