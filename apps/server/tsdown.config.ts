import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "es2023",
  fixedExtension: false,
  clean: true,
  deps: {
    alwaysBundle: ["@splidly/db", "@splidly/shared"],
  },
});
