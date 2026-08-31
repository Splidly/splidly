import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryDirectory = resolve(import.meta.dirname, "..");
const errors = [];
const allowedEnvironmentFiles = new Set([
  ".env.example",
  ".env.production.example",
]);
const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: repositoryDirectory,
})
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const forbiddenPathPatterns = [
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)(?:AuthKey_[^/]+\.p8|google-services\.json|GoogleService-Info\.plist)$/i,
  /\.(?:bak|backup|db|dump|jks|key|keystore|mobileprovision|p12|p8|pem|sqlite)$/i,
  /(^|\/)backups?\//i,
  /^ops\/macos\/.*\.plist$/,
];

for (const path of trackedFiles) {
  if (
    forbiddenPathPatterns.some((pattern) => pattern.test(path)) &&
    !allowedEnvironmentFiles.has(path)
  ) {
    errors.push(`sensitive or machine-specific path is tracked: ${path}`);
  }
}

const contentPatterns = [
  [
    "private key material",
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  ],
  ["GitHub token", /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,})/],
  ["OpenAI-style secret", /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["Slack token", /xox[baprs]-[0-9A-Za-z-]{10,}/],
  ["GitLab token", /glpat-[0-9A-Za-z_-]{20,}/],
  [
    "personal macOS home path",
    /\/Users\/(?!you(?:\/|$)|USERNAME(?:\/|$)|REPLACE_ME(?:\/|$))[^/\s"']+/,
  ],
  ["personal Windows home path", /[A-Z]:\\Users\\(?!USERNAME\\|REPLACE_ME\\)[^\\\s"']+/i],
];

for (const path of trackedFiles) {
  const value = readFileSync(resolve(repositoryDirectory, path));
  if (value.includes(0)) continue;
  const text = value.toString("utf8");
  for (const [label, pattern] of contentPatterns) {
    if (pattern.test(text)) errors.push(`${label} found in ${path}`);
  }
}

const manifestPaths = trackedFiles.filter(
  (path) => path === "package.json" || path.endsWith("/package.json"),
);
for (const path of manifestPaths) {
  const manifest = JSON.parse(
    readFileSync(resolve(repositoryDirectory, path), "utf8"),
  );
  if (manifest.private !== true) {
    errors.push(`${path} must set \"private\": true to prevent registry publication`);
  }
}

const noticesPath = "THIRD_PARTY_NOTICES.md";
if (!trackedFiles.includes(noticesPath)) {
  errors.push(`${noticesPath} is missing`);
} else {
  const notices = readFileSync(
    resolve(repositoryDirectory, noticesPath),
    "utf8",
  );
  for (const asset of [
    "apps/server/assets/app-store-badge.svg",
    "apps/server/assets/google-play-badge.png",
  ]) {
    if (trackedFiles.includes(asset) && !notices.includes(`\`${asset}\``)) {
      errors.push(`${asset} is not covered by ${noticesPath}`);
    }
  }
}

const revisions = execFileSync("git", ["rev-list", "--all"], {
  cwd: repositoryDirectory,
})
  .toString("utf8")
  .trim()
  .split(/\s+/)
  .filter(Boolean);
const historyPattern = [
  "-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
  "github_pat_[A-Za-z0-9_]{20,}",
  "gh[pousr]_[A-Za-z0-9]{30,}",
  "sk-(proj-)?[A-Za-z0-9_-]{20,}",
  "AKIA[0-9A-Z]{16}",
  "AIza[0-9A-Za-z_-]{30,}",
  "xox[baprs]-[0-9A-Za-z-]{10,}",
  "glpat-[0-9A-Za-z_-]{20,}",
].join("|");
if (revisions.length > 0) {
  const historyScan = spawnSync(
    "git",
    ["grep", "-I", "-l", "-E", "-e", historyPattern, ...revisions],
    {
      cwd: repositoryDirectory,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  if (historyScan.status === 0) {
    const paths = new Set(
      historyScan.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => line.slice(line.indexOf(":") + 1)),
    );
    errors.push(
      `high-confidence secret signature found in Git history: ${[...paths].join(", ")}`,
    );
  } else if (historyScan.status !== 1) {
    errors.push(`unable to scan Git history: ${historyScan.stderr.trim()}`);
  }
}

if (errors.length > 0) {
  process.stderr.write(
    `Publication validation failed:\n${errors
      .map((error) => `- ${error}`)
      .join("\n")}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Publication validation passed for ${trackedFiles.length} tracked files and ${revisions.length} reachable commits.\n`,
);
