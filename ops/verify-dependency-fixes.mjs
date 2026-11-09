import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// Exercise the actual installed CJS/ESM artifacts, not just patch text or versions.
// Upstream regressions: node-glob 4682e8c, minimatch 77a0f5c.
async function probe(kind, entry) {
  const imported = entry.includes("/esm/")
    ? await import(pathToFileURL(entry).href)
    : createRequire(import.meta.url)(entry);
  if (kind === "deepmerge") {
    const merge = imported.default ?? imported;
    const poison = JSON.parse('{"__proto__":{"poisoned":true},"normal":{"value":1}}');
    for (const result of [merge(Object.create(null), poison), merge(poison, {})]) {
      assert.equal(Object.getPrototypeOf(result), Object.prototype);
      assert.equal(result.poisoned, undefined);
      assert.equal(result.normal.value, 1);
    }
    assert.deepEqual(merge({ a: [1] }, { a: [2], b: true }), { a: [1, 2], b: true });
  } else if (kind === "minimatch") {
    const { Minimatch } = imported;
    const pattern = Array(12).fill("**/../a/b").join("/");
    const bounded = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 64 });
    assert.equal(bounded.set.length, 64);
    const large = new Minimatch("{x,*}/{0..999}", { optimizationLevel: 2 });
    assert.equal(large.set.length, 2000);
    assert.equal(large.match("y/999"), true);
    assert.equal(large.match(".y/999"), false);
    const ordinary = new Minimatch("**/../a/b/**/../c/d", { optimizationLevel: 2 });
    assert.equal(ordinary.match("x/a/b/y/c/d"), true);
  } else {
    const cwd = fs.mkdtempSync(join(tmpdir(), "splidly-glob-regression-"));
    const tree = (path, depth) => {
      fs.mkdirSync(path, { recursive: true });
      fs.writeFileSync(join(path, "file"), "");
      if (depth) for (const name of ["a", "b", "c"]) tree(join(path, name), depth - 1);
    };
    try {
      tree(cwd, 4);
      for (const sync of [false, true]) {
        const controller = new AbortController();
        const reason = new Error("test cancellation");
        let reads = 0;
        const count = () => { if (++reads === 1) controller.abort(reason); };
        const counted = { ...fs,
          readdir(...args) { count(); return fs.readdir(...args); },
          readdirSync(...args) { count(); return fs.readdirSync(...args); },
        };
        const options = { cwd, signal: controller.signal, fs: counted };
        if (sync) {
          await new Promise((yes, no) => {
            const stream = imported.globStreamSync("**", options);
            stream.on("error", error => error === reason ? yes() : no(error));
            stream.on("end", () => no(new Error("Cancelled stream unexpectedly completed")));
            stream.resume();
          });
        } else {
          await assert.rejects(imported.glob("**", options), error => error === reason);
        }
        await new Promise(done => setTimeout(done, 50));
        assert.equal(reads, 1, "Filesystem traversal continued after cancellation");
      }
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  }
}

if (process.argv[2] === "--probe") {
  await probe(process.argv[3], process.argv[4]);
} else {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const targets = new Set(["glob@10.5.0", "glob@13.0.6", "minimatch@9.0.9", "minimatch@10.2.6", "deepmerge@4.3.1"]);
  const pending = ["package.json", "apps/mobile/package.json", "apps/server/package.json", "packages/db/package.json", "packages/shared/package.json"]
    .map(path => resolve(root, path));
  const visited = new Set();
  const found = new Set();
  let probes = 0;
  const resolveManifest = (parent, name) => {
    for (let path = dirname(parent); ; path = dirname(path)) {
      const candidate = join(path, "node_modules", name, "package.json");
      if (fs.existsSync(candidate)) return fs.realpathSync(candidate);
      if (dirname(path) === path) return;
    }
  };
  while (pending.length) {
    const path = fs.realpathSync(pending.pop());
    if (visited.has(path)) continue;
    visited.add(path);
    const manifest = JSON.parse(fs.readFileSync(path, "utf8"));
    const key = `${manifest.name}@${manifest.version}`;
    if (targets.has(key)) {
      found.add(key);
      const entries = manifest.name === "deepmerge"
        ? ["dist/cjs.js", "dist/umd.js"]
        : ["commonjs", "esm"].map(format => `dist/${format}/index.js`);
      for (const entry of entries) {
        const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--probe", manifest.name, join(dirname(path), entry)],
          { encoding: "utf8", timeout: 10_000 });
        assert.equal(result.status, 0, `${key} (${entry}): ${result.error?.message ?? result.stderr}`);
        probes++;
      }
    }
    for (const name of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies,
      ...(path.startsWith(join(root, "node_modules")) ? {} : manifest.devDependencies) })) {
      const dependency = resolveManifest(path, name);
      if (dependency) pending.push(dependency);
    }
  }
  assert.deepEqual([...found].sort(), [...targets].sort(), "Expected installed security backports were not found");
  console.log(`Dependency security regressions passed: ${probes} entry points across ${found.size} patched releases`);
}
