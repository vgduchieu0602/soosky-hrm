import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Bản kê ROUTE của backend — hợp đồng dùng chung với frontend.
 *
 * Test này đọc thẳng file router của từng module, trích danh sách route thật rồi
 * ghi ra `share-docs/api-routes.json`. Frontend có một test đối chiếu mọi URL nó
 * gọi với chính file này, nên đổi/xoá route ở backend mà quên sửa frontend sẽ
 * làm ĐỎ test bên kia thay vì ra lỗi 404 lúc chạy.
 *
 * Không dựng Express thật: khởi tạo app kéo theo MongoDB, trong khi thứ cần đối
 * chiếu chỉ là đường dẫn tĩnh.
 */

const API_PREFIX = "/api/v1";

const MODULE_ROUTERS: { mount: string; file: string }[] = [
    { mount: "auth",        file: "src/modules/auth/adapters/driver/http/index.ts" },
    { mount: "iam",         file: "src/modules/iam/adapters/driver/http/index.ts" },
    { mount: "department",  file: "src/modules/department/adapters/driver/http/index.ts" },
    { mount: "employee",    file: "src/modules/employee/adapters/driver/http/index.ts" },
    { mount: "attendance",  file: "src/modules/attendance/adapters/driver/http/index.ts" },
    { mount: "payroll",     file: "src/modules/payroll/adapters/driver/http/index.ts" },
    { mount: "performance", file: "src/modules/performance/adapters/driver/http/index.ts" },
    { mount: "setting",     file: "src/modules/setting/adapters/driver/http/index.ts" },
    { mount: "dashboard",   file: "src/modules/dashboard/adapters/driver/http/index.ts" },
];

const ROUTE_PATTERN = /router\.(get|post|put|patch|delete)\s*\(\s*"([^"]+)"/g;

/** `/periods/:periodId/run/:employeeId` -> `/periods/:id/run/:id` (so khớp không phụ thuộc tên tham số). */
function normalize(path: string): string {
    return path.replace(/:[A-Za-z0-9_]+/g, ":id");
}

function collectRoutes(): string[] {
    const routes = new Set<string>([`GET ${API_PREFIX}/health`]);

    for (const { mount, file } of MODULE_ROUTERS) {
        const source = readFileSync(resolve(process.cwd(), file), "utf8");

        for (const match of source.matchAll(ROUTE_PATTERN)) {
            const method = (match[1] ?? "").toUpperCase();
            const path   = match[2] ?? "";
            const full   = `${API_PREFIX}/${mount}${path === "/" ? "" : path}`;
            routes.add(`${method} ${normalize(full)}`);
        }
    }

    return [...routes].sort();
}

const MANIFEST_PATH = resolve(process.cwd(), "../share-docs/api-routes.json");

describe("bản kê route backend", () => {
    it("ghi lại bản kê route cho frontend đối chiếu", () => {
        const routes = collectRoutes();

        // Đủ nhiều để chắc chắn đã đọc được router, không phải regex trượt.
        expect(routes.length).toBeGreaterThan(100);
        expect(routes).toContain("POST /api/v1/auth/sessions");
        expect(routes).toContain("GET /api/v1/payroll/periods/:id/bank-file");
        expect(routes).toContain("GET /api/v1/attendance/records/visible");
        expect(routes).toContain("GET /api/v1/dashboard/overview");

        const body = `${JSON.stringify({ apiPrefix: API_PREFIX, routes }, null, 2)}\n`;
        const previous = (() => {
            try { return readFileSync(MANIFEST_PATH, "utf8"); } catch { return ""; }
        })();

        if (previous !== body) writeFileSync(MANIFEST_PATH, body);

        expect(readFileSync(MANIFEST_PATH, "utf8")).toBe(body);
    });

    it("không có route trùng nhau", () => {
        const routes = collectRoutes();
        expect(new Set(routes).size).toBe(routes.length);
    });
});
