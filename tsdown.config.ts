import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
    api: "src/api.ts",
    errors: "src/errors.ts",
    permissions: "src/permissions.ts",
    types: "src/types.ts",
  },
  banner: (chunk) => {
    if (chunk.fileName.startsWith("cli")) {
      return "#!/usr/bin/env node";
    }
    return "";
  },
  format: "esm",
  platform: "node",
  outDir: "dist",
  dts: true,
  clean: true,
  sourcemap: true,
});
