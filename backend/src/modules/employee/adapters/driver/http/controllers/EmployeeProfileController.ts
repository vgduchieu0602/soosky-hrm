import EmployeeProfilePresenter from "@modules/employee/adapters/driver/http/presenters/EmployeeProfilePresenter";
import GetEmployeeProfileUseCase from "@modules/employee/core/app/use-cases/profile/GetEmployeeProfileUseCase";
import UpdateEmployeeProfileUseCase from "@modules/employee/core/app/use-cases/profile/UpdateEmployeeProfileUseCase";
import ActorContext from "@shared/adapters/driver/http/ActorContext";
import { bodySchema, field } from "@shared/adapters/driver/http/validation";
import { Request, Response } from "express";

export interface EmployeeProfileControllerUseCases {
    getEmployeeProfile:    GetEmployeeProfileUseCase;
    updateEmployeeProfile: UpdateEmployeeProfileUseCase;
}

const bodySchemaUpdateProfile = bodySchema({
    firstName:         field.optionalString,
    lastName:          field.optionalString,
    middleName:        field.optionalString,
    dateOfBirth:       field.optionalDate,
    gender:            field.optionalString,
    nationality:       field.optionalString,
    maritalStatus:     field.optionalString,
    avatarUrl:         field.optionalString,
    personalEmail:     field.optionalString,
    workEmail:         field.optionalString,
    phone:             field.optionalString,
    address:           field.optionalString,
    socialInsuranceNo: field.optionalString,
    taxCode:           field.optionalString,
    vehiclePlate:      field.optionalString,
});

/** Controller nhóm endpoint hồ sơ cá nhân (1-1) của nhân viên. */
export default class EmployeeProfileController {
    public constructor(
        private readonly _useCases: EmployeeProfileControllerUseCases,
    ) {}

    public getEmployeeProfile = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        const profile = await this._useCases.getEmployeeProfile.execute({ employeeId: req.params.employeeId });
        res.status(200).json(EmployeeProfilePresenter.toDTO(profile));
    };

    public updateEmployeeProfile = async (req: Request<{ employeeId: string }>, res: Response): Promise<void> => {
        await this._useCases.updateEmployeeProfile.execute({
            ...bodySchemaUpdateProfile.parse(req.body),
            employeeId:  req.params.employeeId,
            actorUserId: ActorContext.get(res),
        });
        res.status(200).end();
    };
}
