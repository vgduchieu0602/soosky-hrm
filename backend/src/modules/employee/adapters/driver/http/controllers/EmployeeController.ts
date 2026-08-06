import EmployeePresenter from "@modules/employee/adapters/driver/http/presenters/EmployeePresenter";
import CreateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/CreateEmployeeUseCase";
import GetEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/GetEmployeeUseCase";
import GrantEmployeeLoginUseCase from "@modules/employee/core/app/use-cases/employee/GrantEmployeeLoginUseCase";
import ListEmployeesUseCase from "@modules/employee/core/app/use-cases/employee/ListEmployeesUseCase";
import TerminateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/TerminateEmployeeUseCase";
import UpdateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/UpdateEmployeeUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface EmployeeControllerUseCases {
    createEmployee:    CreateEmployeeUseCase;
    updateEmployee:    UpdateEmployeeUseCase;
    getEmployee:       GetEmployeeUseCase;
    listEmployees:     ListEmployeesUseCase;
    terminateEmployee: TerminateEmployeeUseCase;
    grantEmployeeLogin: GrantEmployeeLoginUseCase;
}

const bodySchemaCreateEmployee = bodySchema({
    code:         field.string,
    name:         field.string,
    email:        field.optionalString,
    phone:        field.optionalString,
    dob:          field.optionalDate,
    gender:       field.optionalString,
    departmentId: field.string,
    positionId:   field.string,
    managerId:    field.optionalString,
    hireDate:     field.date,
    employeeType: field.string,
    accountId:    field.optionalString,
});

const bodySchemaUpdateEmployee = bodySchema({
    code:         field.optionalString,
    name:         field.optionalString,
    email:        field.optionalString,
    phone:        field.optionalString,
    departmentId: field.optionalString,
    positionId:   field.optionalString,
    managerId:    field.optionalString,
    employeeType: field.optionalString,
});

const bodySchemaTerminateEmployee = bodySchema({
    terminationDate: field.date,
    note:            field.optionalString,
});

// Bỏ trống `email` → dùng email trên hồ sơ nhân viên.
const bodySchemaGrantLogin = bodySchema({
    email: field.optionalString,
});

/**
 * Controller nhóm endpoint Employee: parse request, gọi use-case, ghi
 * response — không chứa nghiệp vụ.
 */
export default class EmployeeController {
    public constructor(
        private readonly _useCases: EmployeeControllerUseCases,
    ) {}

    public createEmployee = async (req: Request, res: Response): Promise<void> => {
        const output = await this._useCases.createEmployee.execute({
            ...bodySchemaCreateEmployee.parse(req.body),
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };

    public listEmployees = async (req: Request, res: Response): Promise<void> => {
        const employees = await this._useCases.listEmployees.execute({
            departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
            status:       typeof req.query.status === "string" ? req.query.status : undefined,
            actorUserId:  ActorContext.get(res),
        });
        res.status(200).json({ employees: employees.map(EmployeePresenter.toDTO) });
    };

    public getEmployee = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const employee = await this._useCases.getEmployee.execute({ employeeId: req.params.employeeId, actorUserId: ActorContext.get(res) });
        res.status(200).json(EmployeePresenter.toDTO(employee));
    };

    public updateEmployee = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        await this._useCases.updateEmployee.execute({
            ...bodySchemaUpdateEmployee.parse(req.body),
            employeeId:  req.params.employeeId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };

    public terminateEmployee = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const body = bodySchemaTerminateEmployee.parse(req.body);
        await this._useCases.terminateEmployee.execute({
            employeeId:      req.params.employeeId,
            terminationDate: body.terminationDate,
            note:            body.note,
            actorUserId:     ActorContext.get(res),
        });
        res.status(200).end();
    };

    public grantEmployeeLogin = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const body   = bodySchemaGrantLogin.parse(req.body ?? {});
        const output = await this._useCases.grantEmployeeLogin.execute({
            employeeId:  req.params.employeeId,
            email:       body.email,
            actorUserId: ActorContext.get(res),
        });
        res.status(201).json(output);
    };
}
