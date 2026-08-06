import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import LeaveAccessScope from "@modules/attendance/core/app/services/LeaveAccessScope";
import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { describe, expect, it } from "vitest";

/**
 * Sơ đồ dùng chung:
 *   acc-hr       → không gắn nhân viên nào (HR thuần), phạm vi `all`
 *   acc-manager  → emp-manager, phạm vi `team`, quản lý emp-staff
 *   acc-staff    → emp-staff, phạm vi `self`
 *   emp-outsider → không thuộc nhóm ai
 */
function directory(): EmployeeDirectory {
    const employeeByAccount: Record<string, string> = {
        "acc-manager": "emp-manager",
        "acc-staff":   "emp-staff",
    };
    const managerOf: Record<string, string> = {
        "emp-staff": "acc-manager",
    };

    return {
        async employeeExists() { return true; },
        async findEmployeeIdByUserId(userId: string) { return employeeByAccount[userId]; },
        async isManagedBy(employeeId: string, actorUserId: string) { return managerOf[employeeId] === actorUserId; },
        async listTeamEmployeeIds(actorUserId: string) {
            const own = employeeByAccount[actorUserId];
            if (own == undefined) return [];
            const reports = Object.entries(managerOf)
                .filter(([, manager]) => manager === actorUserId)
                .map(([employeeId]) => employeeId);
            return [own, ...reports];
        },
    };
}

/** Trả phạm vi theo actor; actor không có trong bảng → AccessDenied. */
function permissions(scopeByActor: Record<string, PermissionScope>): PermissionChecker {
    return {
        async assertPermission() { /* không dùng ở đây */ },
        async resolveScope(actorUserId: string) {
            const scope = scopeByActor[actorUserId];
            if (scope == undefined) throw new AccessDeniedError();
            return scope;
        },
    };
}

const SCOPES: Record<string, PermissionScope> = {
    "acc-hr":      "all",
    "acc-manager": "team",
    "acc-staff":   "self",
};

function scope(): LeaveAccessScope {
    return new LeaveAccessScope(permissions(SCOPES), directory());
}

describe("LeaveAccessScope — nộp đơn", () => {
    it("không truyền employeeId: suy ra chính nhân viên của actor", async () => {
        expect(await scope().resolveSubjectEmployeeId("acc-staff")).toBe("emp-staff");
    });

    it("HR nộp thay được cho bất kỳ ai", async () => {
        expect(await scope().resolveSubjectEmployeeId("acc-hr", "emp-outsider")).toBe("emp-outsider");
    });

    it("HR thuần (không gắn nhân viên) không nộp được khi bỏ trống employeeId", async () => {
        // Không có nhân viên nào để suy ra → chặn, thay vì im lặng tạo đơn sai người.
        await expect(scope().resolveSubjectEmployeeId("acc-hr")).rejects.toBeInstanceOf(AccessDeniedError);
    });

    it("Employee không nộp thay người khác", async () => {
        await expect(scope().resolveSubjectEmployeeId("acc-staff", "emp-outsider"))
            .rejects.toBeInstanceOf(AccessDeniedError);
    });

    it("Employee nộp cho chính mình khi truyền đúng id của mình", async () => {
        expect(await scope().resolveSubjectEmployeeId("acc-staff", "emp-staff")).toBe("emp-staff");
    });

    it("Manager nộp cho chính mình và cho cấp dưới, không cho người ngoài nhóm", async () => {
        expect(await scope().resolveSubjectEmployeeId("acc-manager", "emp-manager")).toBe("emp-manager");
        expect(await scope().resolveSubjectEmployeeId("acc-manager", "emp-staff")).toBe("emp-staff");
        await expect(scope().resolveSubjectEmployeeId("acc-manager", "emp-outsider"))
            .rejects.toBeInstanceOf(AccessDeniedError);
    });

    it("không có quyền nộp → AccessDeniedError", async () => {
        await expect(scope().resolveSubjectEmployeeId("acc-la", "emp-staff"))
            .rejects.toBeInstanceOf(AccessDeniedError);
    });
});

describe("LeaveAccessScope — xem đơn và số dư", () => {
    it("phạm vi all: không giới hạn id", async () => {
        expect(await scope().visibleEmployeeIds("acc-hr")).toBeUndefined();
    });

    it("phạm vi team: chính mình + cấp dưới", async () => {
        expect((await scope().visibleEmployeeIds("acc-manager"))?.sort()).toEqual(["emp-manager", "emp-staff"]);
    });

    it("phạm vi self: đúng một mình", async () => {
        expect(await scope().visibleEmployeeIds("acc-staff")).toEqual(["emp-staff"]);
    });

    it("assertCanRead chặn đúng người ngoài phạm vi", async () => {
        await expect(scope().assertCanRead("acc-staff", "emp-staff")).resolves.toBeUndefined();
        await expect(scope().assertCanRead("acc-staff", "emp-manager")).rejects.toBeInstanceOf(AccessDeniedError);
        await expect(scope().assertCanRead("acc-manager", "emp-staff")).resolves.toBeUndefined();
        await expect(scope().assertCanRead("acc-manager", "emp-outsider")).rejects.toBeInstanceOf(AccessDeniedError);
        await expect(scope().assertCanRead("acc-hr", "emp-outsider")).resolves.toBeUndefined();
    });
});
