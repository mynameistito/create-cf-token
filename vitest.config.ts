import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.node.test.ts"],
    environment: "node",
    pool: "forks",
  },
});
