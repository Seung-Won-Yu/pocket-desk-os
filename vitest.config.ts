import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      include: ["src/vfs/**", "src/shell/**", "src/utils/**"],
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
