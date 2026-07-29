import path from "node:path";
import { defineConfig } from "vitest/config";

// Alias khớp với `paths` trong tsconfig.json (khai báo tường minh để runtime của Vitest
// resolve chắc chắn, không phụ thuộc plugin đọc tsconfig).
export default defineConfig({
    resolve: {
        alias: {
            "@infra":   path.resolve(__dirname, "src/infra"),
            "@modules": path.resolve(__dirname, "src/modules"),
            "@shared":  path.resolve(__dirname, "src/shared"),
            "@tests":   path.resolve(__dirname, "tests"),
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
