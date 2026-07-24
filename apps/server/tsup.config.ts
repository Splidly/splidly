import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "es2023",
  clean: true,
  noExternal: ["@splidly/db", "@splidly/shared"],
});

