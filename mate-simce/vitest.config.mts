import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Existing tests/*.test.cjs use node:test and keep their own runner.
    include: ["tests/unit/**/*.test.{js,ts,jsx,tsx}"],
  },
});
