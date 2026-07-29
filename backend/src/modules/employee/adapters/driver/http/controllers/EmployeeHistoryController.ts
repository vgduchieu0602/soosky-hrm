import EmployeeHistoryPresenter from "@modules/employee/adapters/driver/http/presenters/EmployeeHistoryPresenter";
import ListEmployeeHistoryUseCase from "@modules/employee/core/app/use-cases/history/ListEmployeeHistoryUseCase";
import { Request, Response } from "express";

export interface EmployeeHistoryControllerUseCases {
    listEmployeeHistory: ListEmployeeHistoryUseCase;
}

/** Controller nhóm endpoint lịch sử biến động (append-only) của nhân viên. */
export default class EmployeeHistoryController {
    public constructor(
        private readonly _useCases: EmployeeHistoryControllerUseCases,
    ) {}

    public listEmployeeHistory = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const history = await this._useCases.listEmployeeHistory.execute({ employeeId: req.params.employeeId });
        res.status(200).json({ history: history.map(EmployeeHistoryPresenter.toDTO) });
    };
}
