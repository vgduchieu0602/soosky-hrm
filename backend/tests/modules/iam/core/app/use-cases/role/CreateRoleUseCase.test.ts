import { RoleKeyConflictError } from "@modules/iam/core/app/errors/RoleKeyConflictError";
import AuditRepo from "@modules/iam/core/app/ports/AuditRepo";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import CreateRoleUseCase from "@modules/iam/core/app/use-cases/role/CreateRoleUseCase";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { mock } from "vitest-mock-extended";
import { describe, expect, it } from "vitest";

describe("CreateRoleUseCase", () => {
    const ACTOR_USER_ID = "actor-1";

    function makeUseCase() {
        const accessControl = mock<AccessControl>();
        const roleRepo       = mock<RoleRepo>();
        const auditRepo      = mock<AuditRepo>();
        const useCase        = new CreateRoleUseCase(accessControl, roleRepo, auditRepo);
        return { accessControl, roleRepo, auditRepo, useCase };
    }

    it("denies creation when actor lacks 'iam:manage' permission", async () => {
        const { accessControl, roleRepo, useCase } = makeUseCase();
        accessControl.assertPermission.mockRejectedValue(new AccessDeniedError());

        await expect(useCase.execute({
            actorUserId: ACTOR_USER_ID,
            key:         "hr-manager",
            name:        "HR Manager",
            description: "",
        })).rejects.toBeInstanceOf(AccessDeniedError);

        expect(roleRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a duplicate role key", async () => {
        const { accessControl, roleRepo, useCase } = makeUseCase();
        accessControl.assertPermission.mockResolvedValue(undefined);
        roleRepo.existsByKey.mockResolvedValue(true);

        await expect(useCase.execute({
            actorUserId: ACTOR_USER_ID,
            key:         "hr-manager",
            name:        "HR Manager",
            description: "",
        })).rejects.toBeInstanceOf(RoleKeyConflictError);

        expect(roleRepo.save).not.toHaveBeenCalled();
    });

    it("creates the role and writes an audit log on success", async () => {
        const { accessControl, roleRepo, auditRepo, useCase } = makeUseCase();
        accessControl.assertPermission.mockResolvedValue(undefined);
        roleRepo.existsByKey.mockResolvedValue(false);

        const role = await useCase.execute({
            actorUserId: ACTOR_USER_ID,
            key:         "hr-manager",
            name:        "HR Manager",
            description: "Manages HR operations",
        });

        expect(role.key.value).toBe("hr-manager");
        expect(role.isSystem).toBe(false);
        expect(roleRepo.save).toHaveBeenCalledWith(role);
        expect(auditRepo.save).toHaveBeenCalledTimes(1);
    });
});
