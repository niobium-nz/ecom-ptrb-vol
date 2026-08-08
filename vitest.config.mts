import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/{unit,components,integration}/**/*.{test,spec}.{ts,tsx,mjs}"],
    coverage: {
      provider: "v8",
      include: [
        "scripts/**",
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "scripts/**/*.{js,mjs,ts}",
      ],
      exclude: [
        "**/*.d.ts",
        "lib/generated/**",
        "tests/**",
      ],
      thresholds: {
        perFile: true,
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      reporter: ["text", "json-summary", "html"],
    },
  },
});
