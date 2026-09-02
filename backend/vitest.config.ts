import path from "node:path";
import { defineConfig } from "vitest/config";

// Alias khớp với `paths` trong tsconfig.json (khai báo tường minh để Vitest
// resolve chắc chắn, không phụ thuộc plugin đọc tsconfig).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@config": path.resolve(__dirname, "src/config"),
      "@core": path.resolve(__dirname, "src/core"),
      "@shared": path.resolve(__dirname, "src/shared"),
      "@features": path.resolve(__dirname, "src/features"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
