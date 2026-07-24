const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { loadEnvFile } = require("node:process");
const { getDefaultConfig } = require("expo/metro-config");

const rootEnvPath = resolve(__dirname, "../../.env");
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

module.exports = getDefaultConfig(__dirname);
