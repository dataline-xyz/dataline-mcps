import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    clean: true,
  },
  {
    entry: { "mcp/server": "src/mcp/server.ts" },
    format: ["esm"],
    dts: false,
    splitting: false,
    clean: false,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
