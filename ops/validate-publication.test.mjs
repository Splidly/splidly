import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const configPath = "apps/mobile/google-services.json";
const apiKey = "AIza" + "a".repeat(35);
const privateKey = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
const config = {
  configuration_version: "1",
  project_info: { project_id: "test-project" },
  client: [{
    client_info: { android_client_info: { package_name: "com.example.test" } },
    api_key: [{ current_key: apiKey }],
  }],
};

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "splidly-publication-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "ops"));
  mkdirSync(join(directory, "apps/mobile"), { recursive: true });
  for (const file of ["validate-publication.mjs", "public-firebase-config.mjs"]) {
    copyFileSync(new URL(file, import.meta.url), join(directory, "ops", file));
  }
  const git = (...args) => execFileSync("git", args, {
    cwd: directory,
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Publication test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Publication test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
  git("init", "--quiet");
  writeFileSync(join(directory, "package.json"), JSON.stringify({ private: true }));
  writeFileSync(join(directory, "THIRD_PARTY_NOTICES.md"), "Test fixture\n");
  return {
    write(path, contents) {
      writeFileSync(join(directory, path), contents);
    },
    commit() {
      git("add", ".");
      git("-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "Fixture");
    },
    check() {
      return spawnSync(process.execPath, ["ops/validate-publication.mjs"], {
        cwd: directory,
        encoding: "utf8",
      });
    },
  };
}

test("allows public Firebase client API keys in the current config and history", (t) => {
  const repo = fixture(t);
  repo.write(configPath, JSON.stringify(config));
  repo.commit();
  const result = repo.check();
  assert.equal(result.status, 0, result.stderr);
});

test("rejects private keys added to an otherwise public Firebase config", (t) => {
  const repo = fixture(t);
  repo.write(configPath, JSON.stringify({ ...config, private_key: privateKey }));
  repo.commit();
  const result = repo.check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /private key material/);
  assert.match(result.stderr, /Git history/);
});

test("rejects historical secrets even after the Firebase config is cleaned up", (t) => {
  const repo = fixture(t);
  repo.write(configPath, JSON.stringify({ ...config, private_key: privateKey }));
  repo.commit();
  repo.write(configPath, JSON.stringify(config));
  repo.commit();
  const result = repo.check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Git history/);
});

test("rejects API keys outside the documented Firebase field", (t) => {
  const repo = fixture(t);
  repo.write(configPath, JSON.stringify({ ...config, unrelated_key: apiKey }));
  repo.commit();
  const result = repo.check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Google API key/);
});

test("keeps other Google services config paths forbidden", (t) => {
  const repo = fixture(t);
  repo.write("google-services.json", JSON.stringify(config));
  repo.commit();
  const result = repo.check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /sensitive or machine-specific path/);
});

test("rejects malformed Firebase config", (t) => {
  const repo = fixture(t);
  repo.write(configPath, "{}");
  repo.commit();
  const result = repo.check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /sensitive or machine-specific path/);
});
