import DepartmentPresenter from "@modules/department/adapters/driver/http/presenters/DepartmentPresenter";
import ArchiveDepartmentUseCase from "@modules/department/core/app/use-cases/department/ArchiveDepartmentUseCase";
import AssignDepartmentHeadUseCase from "@modules/department/core/app/use-cases/department/AssignDepartmentHeadUseCase";
import CreateDepartmentUseCase from "@modules/department/core/app/use-cases/department/CreateDepartmentUseCase";
import DeleteDepartmentUseCase from "@modules/department/core/app/use-cases/department/DeleteDepartmentUseCase";
import GetDepartmentUseCase from "@modules/department/core/app/use-cases/department/GetDepartmentUseCase";
import ListDepartmentsUseCase from "@modules/department/core/app/use-cases/department/ListDepartmentsUseCase";
import ReparentDepartmentUseCase from "@modules/department/core/app/use-cases/department/ReparentDepartmentUseCase";
import UpdateDepartmentUseCase from "@modules/department/core/app/use-cases/department/UpdateDepartmentUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface DepartmentControllerUseCases {
    createDepartment:     CreateDepartmentUseCase;
    updateDepartment:     UpdateDepartmentUseCase;
    getDepartment:        GetDepartmentUseCase;
    listDepartments:      ListDepartmentsUseCase;
    reparentDepartment:   ReparentDepartmentUseCase;
    assignDepartmentHead: AssignDepartmentHeadUseCase;
    archiveDepartment:    ArchiveDepartmentUseCase;
    deleteDepartment:     DeleteDepartmentUseCase;
}

const bodySchemaCreateDepartment = bodySchema({
    code:               field.string,
    name:               field.string,
    description:        field.optionalString,
    parentDepartmentId: field.optionalString,
    managerId:          field.optionalString,
});

const bodySchemaUpdateDepartment = bodySchema({
    code:        field.optionalString,
    name:        field.optionalString,
    description: field.optionalString,
});

const bodySchemaReparent = bodySchema({
    parentDepartmentId: field.optionalString,
});

const bodySchemaAssignHead = bodySchema({
    managerId: field.optionalString,
});

/**
 * Controller nhóm endpoint Department: parse request, gọi use-case, ghi
 * response — không chứa nghiệp vụ. Handler là arrow property để giữ `this`
 * khi truyền rời vào danh sách route.
 */
export default class DepartmentController {
    public constructor(
        private readonly _useCases: DepartmentControllerUseCases,
    ) {}

    public createDepartment = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.createDepartment.execute({
            ...bodySchemaCreateDepartment.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listDepartments = async (req: Request, res: Response): Promise<void> => {
        const departments = await this._useCases.listDepartments.execute({
            tree: req.query.tree === "true",
        });
        res.status(200).json({ departments });
    };

    public getDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        const department = await this._useCases.getDepartment.execute({
            departmentId: req.params.departmentId,
        });
        res.status(200).json(DepartmentPresenter.toDTO(department));
    };

    public updateDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        await this._useCases.updateDepartment.execute({
            ...bodySchemaUpdateDepartment.parse(req.body),
            departmentId: req.params.departmentId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };

    public reparentDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaReparent.parse(req.body);
        await this._useCases.reparentDepartment.execute({
            departmentId:       req.params.departmentId,
            parentDepartmentId: body.parentDepartmentId ?? null,
            actorUserId:        ActorContext.get(res),
        });
        res.status(200).end();
    };

    public assignDepartmentHead = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaAssignHead.parse(req.body);
        await this._useCases.assignDepartmentHead.execute({
            departmentId: req.params.departmentId,
            managerId:    body.managerId ?? null,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };

    public archiveDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        await this._useCases.archiveDepartment.execute({
            departmentId: req.params.departmentId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };

    public deleteDepartment = async (req: Request<{ departmentId: string }>, res: Response): Promise<void> => {
        await this._useCases.deleteDepartment.execute({
            departmentId: req.params.departmentId,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).end();
    };
}
