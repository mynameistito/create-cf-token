import { createRequire } from "node:module";

import { defineConfig } from "tsdown";

const require = createRequire(import.meta.url);
const { version } = require("./package.json") as { version: string };

export default defineConfig({
  clean: true,
  define: {
    "process.env.npm_package_version": JSON.stringify(version),
  },
  dts: true,
  entry: {
    api: "src/api.ts",
    cli: "src/cli.ts",
    errors: "src/errors.ts",
    index: "src/index.ts",
    permissions: "src/permissions.ts",
    types: "src/types.ts",
  },
  format: "esm",
  outDir: "dist",
  platform: "node",
  plugins: [
    {
      name: "cli-shebang",
      renderChunk(code, chunk) {
        if (!chunk.fileName.startsWith("cli")) {
          return null;
        }

        return {
          code: `#!/usr/bin/env node\n${code}`,
          map: null,
        };
      },
    },
  ],
  sourcemap: true,
});
