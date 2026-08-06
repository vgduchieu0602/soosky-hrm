import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Cấu hình riêng cho test TÍCH HỢP — chạy trên MongoDB replica set THẬT
 * (`MONGODB_URI`), khác hẳn suite unit (`vitest.config.mts`) vốn chạy hoàn
 * toàn trong bộ nhớ và không cần hạ tầng.
 *
 * Tách hai suite để `pnpm test` (unit) vẫn chạy được offline trên máy dev,
 * còn `pnpm test:integration` chỉ chạy khi có DB (CI, hoặc dev bật docker).
 *
 * Chạy tuần tự (`singleFork`): các kịch bản dùng chung một database và một
 * chuỗi nghiệp vụ có thứ tự, chạy song song sẽ giẫm chân nhau.
 */
export default defineConfig({
    resolve: {
        alias: {
            "@infra":   path.resolve(import.meta.dirname, "src/infra"),
            "@modules": path.resolve(import.meta.dirname, "src/modules"),
            "@shared":  path.resolve(import.meta.dirname, "src/shared"),
            "@tests":   path.resolve(import.meta.dirname, "tests-integration"),
        },
    },
    test: {
        globals:     true,
        environment: "node",
        include:     ["tests-integration/**/*.test.ts"],
        pool:        "forks",
        // Vitest 4 bỏ `poolOptions.forks.singleFork`; `fileParallelism: false` là
        // tuỳ chọn top-level cho đúng ý định cũ: chạy tuần tự từng file.
        fileParallelism: false,
        // Vòng đời đầy đủ (index + seed + 20+ request) chậm hơn unit test nhiều.
        testTimeout: 120_000,
        hookTimeout: 120_000,
    },
});
