import PerformanceReviewPresenter from "@modules/performance/adapters/driver/http/presenters/PerformanceReviewPresenter";
import AcknowledgeReviewUseCase from "@modules/performance/core/app/use-cases/review/AcknowledgeReviewUseCase";
import AppealReviewUseCase from "@modules/performance/core/app/use-cases/review/AppealReviewUseCase";
import ApproveReviewUseCase from "@modules/performance/core/app/use-cases/review/ApproveReviewUseCase";
import AssignReviewerUseCase from "@modules/performance/core/app/use-cases/review/AssignReviewerUseCase";
import GetReviewUseCase from "@modules/performance/core/app/use-cases/review/GetReviewUseCase";
import ListReviewsUseCase from "@modules/performance/core/app/use-cases/review/ListReviewsUseCase";
import LockReviewUseCase from "@modules/performance/core/app/use-cases/review/LockReviewUseCase";
import RequestReviewChangesUseCase from "@modules/performance/core/app/use-cases/review/RequestReviewChangesUseCase";
import ResolveReviewAppealUseCase from "@modules/performance/core/app/use-cases/review/ResolveReviewAppealUseCase";
import ScoreReviewUseCase from "@modules/performance/core/app/use-cases/review/ScoreReviewUseCase";
import { REVIEW_STATUSES, ReviewStatus } from "@modules/performance/core/domain/entities/PerformanceReview";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import BadRequestError from "@shared/adapters/driver/http/errors/BadRequestError";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface PerformanceReviewControllerUseCases {
    scoreReview:          ScoreReviewUseCase;
    approveReview:        ApproveReviewUseCase;
    requestReviewChanges: RequestReviewChangesUseCase;
    acknowledgeReview:    AcknowledgeReviewUseCase;
    appealReview:         AppealReviewUseCase;
    resolveReviewAppeal:  ResolveReviewAppealUseCase;
    lockReview:           LockReviewUseCase;
    assignReviewer:       AssignReviewerUseCase;
    listReviews:          ListReviewsUseCase;
    getReview:            GetReviewUseCase;
}

const bodySchemaScoreReview = bodySchema({
    managerNote:     field.optionalString,
    strengths:       field.optionalString,
    improvements:    field.optionalString,
    developmentPlan: field.optionalString,
});

const bodySchemaApprove = bodySchema({
    hrNote: field.optionalString,
});

const bodySchemaRequestChanges = bodySchema({
    hrNote: field.string,
});

const bodySchemaAppeal = bodySchema({
    reason: field.string,
});

const bodySchemaResolveAppeal = bodySchema({
    hrNote: field.string,
});

const bodySchemaAssignReviewer = bodySchema({
    reviewerUserId: field.string,
});

/** Controller nhóm endpoint phiếu đánh giá. */
export default class PerformanceReviewController {
    public constructor(
        private readonly _useCases: PerformanceReviewControllerUseCases,
    ) {}

    public listReviews = async (req: Request, res: Response): Promise<void> => {
        const cycleId    = typeof req.query.cycleId === "string" ? req.query.cycleId : undefined;
        const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : undefined;
        const rawStatus  = typeof req.query.status === "string" ? req.query.status : undefined;
        const status     = rawStatus != undefined && (REVIEW_STATUSES as readonly string[]).includes(rawStatus)
            ? rawStatus as ReviewStatus
            : undefined;

        const reviews = await this._useCases.listReviews.execute({
            ...(cycleId != undefined ? { cycleId } : {}),
            ...(employeeId != undefined ? { employeeId } : {}),
            ...(status != undefined ? { status } : {}),
            ...(req.query.assignedToMe === "true" ? { assignedToMe: true } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json({ reviews: reviews.map(PerformanceReviewPresenter.toDTO) });
    };

    public getReview = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        const review = await this._useCases.getReview.execute({
            reviewId:    req.params.reviewId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(PerformanceReviewPresenter.toDTO(review));
    };

    public scoreReview = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        const body   = bodySchemaScoreReview.parse(req.body);
        const output = await this._useCases.scoreReview.execute({
            reviewId:    req.params.reviewId,
            scores:      parseScores((req.body as Record<string, unknown>)?.scores),
            ...body,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(output);
    };

    public approveReview = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaApprove.parse(req.body ?? {});
        await this._useCases.approveReview.execute({
            reviewId: req.params.reviewId,
            ...(body.hrNote != undefined ? { hrNote: body.hrNote } : {}),
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public requestChanges = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaRequestChanges.parse(req.body);
        await this._useCases.requestReviewChanges.execute({
            reviewId:    req.params.reviewId,
            hrNote:      body.hrNote,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public acknowledgeReview = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        await this._useCases.acknowledgeReview.execute({
            reviewId:    req.params.reviewId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public appealReview = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaAppeal.parse(req.body);
        await this._useCases.appealReview.execute({
            reviewId:    req.params.reviewId,
            reason:      body.reason,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public resolveAppeal = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaResolveAppeal.parse(req.body);
        await this._useCases.resolveReviewAppeal.execute({
            reviewId:    req.params.reviewId,
            hrNote:      body.hrNote,
            // Mặc định KHÔNG chấm lại: giữ nguyên điểm là kết cục ít gây bất ngờ
            // hơn, và HR phải nêu rõ ý muốn chấm lại.
            rescore:     (req.body as Record<string, unknown>)?.rescore === true,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public lockReview = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        const output = await this._useCases.lockReview.execute({
            reviewId:    req.params.reviewId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(output);
    };

    public assignReviewer = async (req: Request<{ reviewId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaAssignReviewer.parse(req.body);
        await this._useCases.assignReviewer.execute({
            reviewId:       req.params.reviewId,
            reviewerUserId: body.reviewerUserId,
            actorUserId:    ActorContext.get(res),
        });
        res.status(200).end();
    };
}

/** Parse mảng điểm theo tiêu chí (`bodySchema` chỉ xử lý field phẳng). */
function parseScores(raw: unknown): { criterionId: string; score: number }[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new BadRequestError("'scores' must be a non-empty array");
    }

    return raw.map((entry, index) => {
        const item        = entry as Record<string, unknown>;
        const criterionId = item.criterionId;
        const score       = item.score;

        if (typeof criterionId !== "string" || typeof score !== "number") {
            throw new BadRequestError(`scores[${index}] must have string criterionId and numeric score`);
        }
        return { criterionId, score };
    });
}
