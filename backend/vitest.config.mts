import path from "node:path";
import { defineConfig } from "vitest/config";

// Đuôi `.mts` là CỐ Ý: `package.json` khai `"type": "commonjs"` (tsc build ra CJS),
// nên file config `.ts` dùng cú pháp ESM bị Vitest nạp như CommonJS và cảnh báo.
// `.mts` giữ source build CJS mà config vẫn là ESM thật; `import.meta.dirname`
// thay `__dirname` vì ESM không có biến đó.

// Alias khớp với `paths` trong tsconfig.json (khai báo tường minh để runtime của Vitest
// resolve chắc chắn, không phụ thuộc plugin đọc tsconfig).
export default defineConfig({
    resolve: {
        alias: {
            "@infra":   path.resolve(import.meta.dirname, "src/infra"),
            "@modules": path.resolve(import.meta.dirname, "src/modules"),
            "@shared":  path.resolve(import.meta.dirname, "src/shared"),
            "@tests":   path.resolve(import.meta.dirname, "tests"),
        },
    },
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "v8",
            include: ["src/modules/task-mgmt/core/**"],
        },
    },
});
