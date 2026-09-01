import { accessSync, constants } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import mobileConfigModule from "../apps/mobile/production-config.js";

const envPath = resolve(process.argv[2] ?? ".env");
try {
  loadEnvFile(envPath);
} catch {
  process.stderr.write(`Unable to load production environment: ${envPath}\n`);
  process.exit(1);
}

const errors = [];
const placeholder = /replace|changeme|example|configure-me|placeholder/i;
const requiredKeys = [
  "APP_DOMAIN",
  "POSTGRES_PASSWORD",
  "POSTGRES_RUNTIME_PASSWORD",
  "BETTER_AUTH_SECRET",
  "APPLE_SIGN_IN_CLIENT_ID",
  "APPLE_SIGN_IN_KEY_ID",
  "APPLE_SIGN_IN_PRIVATE_KEY_FILE",
  "APNS_KEY_ID",
  "APNS_PRIVATE_KEY_FILE",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "IOS_APP_ID",
  "IOS_TEAM_ID",
  "IOS_STORE_URL",
  "LEGAL_NAME",
  "LEGAL_STREET_ADDRESS",
  "LEGAL_POSTAL_CODE",
  "LEGAL_LOCALITY",
  "LEGAL_COUNTRY",
  "LEGAL_EMAIL",
  "LEGAL_PHONE",
  "PRIVACY_EMAIL",
  "ABUSE_EMAIL",
  "BACKUPS_ENABLED",
  "EDGE_LOG_RETENTION_DAYS",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_APP_URL",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  "GOOGLE_IOS_REVERSED_CLIENT_ID",
];

const androidEnabled = process.env.ANDROID_ENABLED === "true";
if (!["true", "false"].includes(process.env.ANDROID_ENABLED ?? "")) {
  errors.push("ANDROID_ENABLED must be true or false");
}
const backupsEnabled = process.env.BACKUPS_ENABLED === "true";
if (!["true", "false"].includes(process.env.BACKUPS_ENABLED ?? "")) {
  errors.push("BACKUPS_ENABLED must be true or false");
}
if (backupsEnabled) {
  requiredKeys.push("OFFSITE_BACKUP_PROVIDER", "OFFSITE_BACKUP_COUNTRY");
}
if (androidEnabled) {
  requiredKeys.push(
    "ANDROID_PACKAGE",
    "ANDROID_SHA256_FINGERPRINT",
    "ANDROID_STORE_URL",
  );
}

for (const key of requiredKeys) {
  const value = process.env[key]?.trim();
  if (!value || placeholder.test(value)) errors.push(`${key} is not configured`);
}
if (!/^\d+$/.test(process.env.EDGE_LOG_RETENTION_DAYS ?? "")) {
  errors.push("EDGE_LOG_RETENTION_DAYS must be an integer from 0 to 30");
} else if (Number(process.env.EDGE_LOG_RETENTION_DAYS) > 30) {
  errors.push("EDGE_LOG_RETENTION_DAYS must not exceed 30");
}
if (
  Boolean(process.env.LEGAL_REGISTRY_NAME?.trim()) !==
  Boolean(process.env.LEGAL_REGISTRY_NUMBER?.trim())
) {
  errors.push(
    "LEGAL_REGISTRY_NAME and LEGAL_REGISTRY_NUMBER must be configured together",
  );
}

if (process.env.NODE_ENV !== "production") {
  errors.push("NODE_ENV must be production");
}
if (process.env.LOG_FORMAT && process.env.LOG_FORMAT !== "json") {
  errors.push("LOG_FORMAT must be json");
}
if ((process.env.POSTGRES_PASSWORD?.length ?? 0) < 24) {
  errors.push("POSTGRES_PASSWORD must contain at least 24 characters");
}
if (!/^[A-Za-z0-9_-]{24,}$/.test(process.env.POSTGRES_PASSWORD ?? "")) {
  errors.push("POSTGRES_PASSWORD must use URL-safe base64 characters");
}
if ((process.env.POSTGRES_RUNTIME_PASSWORD?.length ?? 0) < 24) {
  errors.push("POSTGRES_RUNTIME_PASSWORD must contain at least 24 characters");
}
if (
  !/^[A-Za-z0-9_-]{24,}$/.test(
    process.env.POSTGRES_RUNTIME_PASSWORD ?? "",
  )
) {
  errors.push("POSTGRES_RUNTIME_PASSWORD must use URL-safe base64 characters");
}
if (
  process.env.POSTGRES_RUNTIME_PASSWORD &&
  process.env.POSTGRES_RUNTIME_PASSWORD === process.env.POSTGRES_PASSWORD
) {
  errors.push("POSTGRES_RUNTIME_PASSWORD must differ from POSTGRES_PASSWORD");
}
if (
  !/^[a-z_][a-z0-9_]{0,62}$/.test(
    process.env.POSTGRES_RUNTIME_USER ?? "splidly_app",
  )
) {
  errors.push("POSTGRES_RUNTIME_USER is not a safe PostgreSQL role name");
}
const authSecret = process.env.BETTER_AUTH_SECRET ?? "";
if (authSecret.length < 43 || new Set(authSecret).size < 12) {
  errors.push("BETTER_AUTH_SECRET must be a high-entropy 43+ character value");
}
if (process.env.APNS_ENVIRONMENT !== "production") {
  errors.push("APNS_ENVIRONMENT must be production");
}
if (!/^[A-Z0-9]{10}$/.test(process.env.IOS_TEAM_ID ?? "")) {
  errors.push("IOS_TEAM_ID must be a 10-character Apple Team ID");
}
for (const key of ["APPLE_SIGN_IN_KEY_ID", "APNS_KEY_ID"]) {
  if (!/^[A-Z0-9]{10}$/.test(process.env[key] ?? "")) {
    errors.push(`${key} must be a 10-character Apple key ID`);
  }
}
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i;
const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINT ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (
  androidEnabled &&
  (fingerprints.length === 0 ||
    fingerprints.some((value) => !fingerprintPattern.test(value)))
) {
  errors.push("ANDROID_SHA256_FINGERPRINT is not a valid SHA-256 fingerprint list");
}

const expectedOrigin = `https://${process.env.APP_DOMAIN ?? ""}`;
if (process.env.EXPO_PUBLIC_API_URL !== expectedOrigin) {
  errors.push("EXPO_PUBLIC_API_URL must match APP_DOMAIN");
}
if (process.env.EXPO_PUBLIC_APP_URL !== expectedOrigin) {
  errors.push("EXPO_PUBLIC_APP_URL must match APP_DOMAIN");
}
if (process.env.GOOGLE_CLIENT_ID !== process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
  errors.push("GOOGLE_CLIENT_ID must match EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");
}
try {
  const iosStoreUrl = new URL(process.env.IOS_STORE_URL ?? "");
  if (
    iosStoreUrl.hostname !== "apps.apple.com" ||
    !/\/id\d+(?:\/|$)/.test(iosStoreUrl.pathname)
  ) {
    errors.push("IOS_STORE_URL is not a final App Store URL");
  }
} catch {
  errors.push("IOS_STORE_URL is invalid");
}
if (androidEnabled) {
  try {
    const androidStoreUrl = new URL(process.env.ANDROID_STORE_URL ?? "");
    if (
      androidStoreUrl.hostname !== "play.google.com" ||
      androidStoreUrl.pathname !== "/store/apps/details" ||
      androidStoreUrl.searchParams.get("id") !== process.env.ANDROID_PACKAGE
    ) {
      errors.push("ANDROID_STORE_URL must match ANDROID_PACKAGE");
    }
  } catch {
    errors.push("ANDROID_STORE_URL is invalid");
  }
}

for (const key of [
  "APPLE_SIGN_IN_PRIVATE_KEY_FILE",
  "APNS_PRIVATE_KEY_FILE",
]) {
  const value = process.env[key];
  if (!value || !isAbsolute(value)) {
    errors.push(`${key} must be an absolute path`);
    continue;
  }
  try {
    accessSync(value, constants.R_OK);
  } catch {
    errors.push(`${key} is not readable`);
  }
}

try {
  mobileConfigModule.resolveMobileBuildConfig({
    ...process.env,
    APP_ENV: "production",
  });
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

if (errors.length > 0) {
  process.stderr.write(
    `Production configuration is not ready:\n${errors
      .map((error) => `- ${error}`)
      .join("\n")}\n`,
  );
  process.exit(1);
}

process.stdout.write("Production environment validation passed.\n");
