import DashboardOverviewPresenter from "@modules/dashboard/adapters/driver/http/presenters/DashboardOverviewPresenter";
import GetDashboardOverviewUseCase from "@modules/dashboard/core/app/use-cases/GetDashboardOverviewUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { Request, Response } from "express";

export interface DashboardControllerUseCases {
    getDashboardOverview: GetDashboardOverviewUseCase;
}

/** Controller của bảng điều khiển — read-only, không nhận tham số nào. */
export default class DashboardController {
    public constructor(
        private readonly _useCases: DashboardControllerUseCases,
    ) {}

    /**
     * Không có query param nào: phạm vi dữ liệu do BACKEND suy ra từ access token.
     * Cho client tự chọn `scope`/`employeeId` là mở đường xem dữ liệu ngoài quyền.
     */
    public getOverview = async (_req: Request, res: Response): Promise<void> => {
        const overview = await this._useCases.getDashboardOverview.execute({
            actorUserId: ActorContext.get(res),
        });
        res.status(200).json(DashboardOverviewPresenter.toDTO(overview));
    };
}
