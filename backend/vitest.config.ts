import path from "node:path";
import { defineConfig } from "vitest/config";

// Alias khớp với `paths` trong tsconfig.json (khai báo tường minh để Vitest
// resolve chắc chắn, không phụ thuộc plugin đọc tsconfig).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@infra": path.resolve(__dirname, "src/infra"),
      "@modules": path.resolve(__dirname, "src/modules"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    globals: true,
    // Every HTTP spec boots its own mongodb-memory-server replica set, which
    // takes well over the 10s default when several start at once — and the box
    // cannot start more than a couple at a time without them timing out.
    hookTimeout: 60_000,
    maxWorkers: 2,
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
