import { resolvePermissionScope } from "@shared/core/app/authorization/PermissionScope";
import { describe, expect, it } from "vitest";

describe("resolvePermissionScope", () => {
    const BASE = "employee:read";

    it("wildcard '*' cho phạm vi toàn bộ", () => {
        expect(resolvePermissionScope(["*"], BASE)).toBe("all");
    });

    it("<resource>:manage bao trùm cả đọc", () => {
        expect(resolvePermissionScope(["employee:manage"], BASE)).toBe("all");
    });

    it("khoá gốc không hậu tố = toàn bộ", () => {
        expect(resolvePermissionScope(["employee:read"], BASE)).toBe("all");
    });

    it("hậu tố :team = phạm vi cấp dưới", () => {
        expect(resolvePermissionScope(["employee:read:team"], BASE)).toBe("team");
    });

    it("hậu tố :self = chỉ chính mình", () => {
        expect(resolvePermissionScope(["employee:read:self"], BASE)).toBe("self");
    });

    it("giữ nhiều quyền thì lấy phạm vi RỘNG nhất", () => {
        expect(resolvePermissionScope(["employee:read:self", "employee:read:team", "employee:read"], BASE)).toBe("all");
        expect(resolvePermissionScope(["employee:read:self", "employee:read:team"], BASE)).toBe("team");
    });

    it("quyền của resource khác không mở phạm vi", () => {
        expect(resolvePermissionScope(["payroll:manage", "department:read"], BASE)).toBeUndefined();
    });

    it("không có quyền nào → undefined (caller ném AccessDenied)", () => {
        expect(resolvePermissionScope([], BASE)).toBeUndefined();
    });
});
