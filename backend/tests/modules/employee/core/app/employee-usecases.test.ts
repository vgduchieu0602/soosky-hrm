import EmployeeCodeConflictError from "@modules/employee/core/app/errors/EmployeeCodeConflictError";
import EmployeeDepartmentNotFoundError from "@modules/employee/core/app/errors/EmployeeDepartmentNotFoundError";
import EmployeeHistoryRepo from "@modules/employee/core/app/ports/EmployeeHistoryRepo";
import EmployeeRepo from "@modules/employee/core/app/ports/EmployeeRepo";
import OrgDirectory from "@modules/employee/core/app/ports/OrgDirectory";
import PermissionChecker from "@modules/employee/core/app/ports/PermissionChecker";
import CreateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/CreateEmployeeUseCase";
import TerminateEmployeeUseCase from "@modules/employee/core/app/use-cases/employee/TerminateEmployeeUseCase";
import Employee from "@modules/employee/core/domain/entities/Employee";
import EmployeeCode from "@modules/employee/core/domain/value-objects/EmployeeCode";
import EmployeeStatus from "@modules/employee/core/domain/value-objects/EmployeeStatus";
import EmployeeType from "@modules/employee/core/domain/value-objects/EmployeeType";
import PersonName from "@modules/employee/core/domain/value-objects/PersonName";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from "vitest-mock-extended";

function employee(id: string, code: string): Employee {
    return Employee.rehydrate({
        id,
        code:            EmployeeCode.create(code),
        name:            PersonName.create("Nguyen Van A"),
        email:           null,
        phone:           null,
        dob:             null,
        gender:          null,
        departmentId:    "dept-1",
        positionId:      "pos-1",
        managerId:       null,
        hireDate:        new Date("2026-01-01"),
        terminationDate: null,
        employeeType:    EmployeeType.FULL_TIME,
        status:          EmployeeStatus.ACTIVE,
        accountId:       null,
        createdAt:       new Date("2026-01-01"),
    });
}

function allowAllPermissions(): MockProxy<PermissionChecker> {
    const permissions = mock<PermissionChecker>();
    permissions.assertPermission.mockResolvedValue(undefined);
    return permissions;
}

function existingOrgDirectory(): MockProxy<OrgDirectory> {
    const org = mock<OrgDirectory>();
    org.departmentExists.mockResolvedValue(true);
    org.positionExists.mockResolvedValue(true);
    return org;
}

describe("CreateEmployeeUseCase", () => {
    let permissions: MockProxy<PermissionChecker>;
    let employeeRepo: MockProxy<EmployeeRepo>;
    let historyRepo: MockProxy<EmployeeHistoryRepo>;
    let orgDirectory: MockProxy<OrgDirectory>;
    let useCase: CreateEmployeeUseCase;

    const baseInput = {
        code:         "NV001",
        name:         "Nguyen Van A",
        departmentId: "dept-1",
        positionId:   "pos-1",
        hireDate:     new Date("2026-01-01"),
        employeeType: "full_time",
        actorUserId:  "u1",
    };

    beforeEach(() => {
        permissions  = allowAllPermissions();
        employeeRepo = mock<EmployeeRepo>();
        historyRepo  = mock<EmployeeHistoryRepo>();
        orgDirectory = existingOrgDirectory();
        useCase      = new CreateEmployeeUseCase(permissions, employeeRepo, historyRepo, orgDirectory);
        employeeRepo.getByCode.mockResolvedValue(undefined);
    });

    it("kiểm tra quyền employee:manage trước khi tạo", async () => {
        await useCase.execute(baseInput);
        expect(permissions.assertPermission).toHaveBeenCalledWith("u1", "employee:manage");
    });

    it("từ chối khi thiếu quyền", async () => {
        permissions.assertPermission.mockRejectedValue(new AccessDeniedError());
        await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(AccessDeniedError);
    });

    it("từ chối mã nhân viên trùng (409)", async () => {
        employeeRepo.getByCode.mockResolvedValue(employee("e1", "NV001"));
        await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(EmployeeCodeConflictError);
    });

    it("từ chối khi phòng ban không tồn tại (404)", async () => {
        orgDirectory.departmentExists.mockResolvedValue(false);
        await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(EmployeeDepartmentNotFoundError);
    });

    it("tạo thành công trả employeeId và ghi lịch sử 'hired'", async () => {
        const out = await useCase.execute(baseInput);
        expect(out.employeeId).toBeTruthy();
        expect(employeeRepo.save).toHaveBeenCalledOnce();
        expect(historyRepo.save).toHaveBeenCalledOnce();
        const savedHistory = historyRepo.save.mock.calls[0]![0];
        expect(savedHistory.eventType).toBe("hired");
    });
});

describe("TerminateEmployeeUseCase", () => {
    it("nghỉ việc là soft update: đổi status + terminationDate, không xoá bản ghi", async () => {
        const permissions  = allowAllPermissions();
        const employeeRepo = mock<EmployeeRepo>();
        const historyRepo  = mock<EmployeeHistoryRepo>();
        const target        = employee("e1", "NV001");
        employeeRepo.getById.mockResolvedValue(target);

        const useCase = new TerminateEmployeeUseCase(permissions, employeeRepo, historyRepo);
        const terminationDate = new Date("2026-06-01");

        await useCase.execute({ employeeId: "e1", terminationDate, actorUserId: "u1" });

        expect(employeeRepo.deleteById).not.toHaveBeenCalled();
        expect(employeeRepo.save).toHaveBeenCalledOnce();
        const saved = employeeRepo.save.mock.calls[0]![0];
        expect(saved.status).toBe(EmployeeStatus.TERMINATED);
        expect(saved.terminationDate).toEqual(terminationDate);
        expect(historyRepo.save).toHaveBeenCalledOnce();
        expect(historyRepo.save.mock.calls[0]![0].eventType).toBe("terminated");
    });
});
