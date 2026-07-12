#!/usr/bin/env node
// scripts/verify-pack.mjs
//
// Prepublish packaging gate for the `inletbase` package.
//
// 1. Parses `package.json` `exports` and asserts that every path referenced by
//    the `import`, `require`, and `types` conditions (including nested
//    `import.types` / `require.types`) resolves to a file that exists in the
//    package (they point into `dist/`). Missing files fail with a non-zero exit
//    naming the offending file. (Requirements 9.2, 9.7)
// 2. Runs `npm pack --dry-run --json` and asserts the packed file set excludes
//    `src/`, `node_modules/`, config files, and `.log` files. (Requirement 9.6)
// 3. On success prints a confirmation and exits 0.

import { readFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, normalize, sep } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const pkgPath = join(packageRoot, "package.json");

/** Print an error and exit non-zero. */
function fail(message) {
  console.error(`\n\u2717 verify-pack failed: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load package.json
// ---------------------------------------------------------------------------
let pkg;
try {
  pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
} catch (err) {
  fail(`unable to read or parse package.json at ${pkgPath}: ${err.message}`);
}

// ---------------------------------------------------------------------------
// 1. Verify every exports-map path exists in the package (dist/)
// ---------------------------------------------------------------------------
const CONDITION_KEYS = ["types", "import", "require", "default", "node"];

/**
 * Collect concrete file paths referenced by an exports entry. Handles both a
 * plain string value and a conditions object, including nested condition
 * objects such as `import: { types, default }`.
 */
function collectPaths(entryName, value, acc) {
  if (typeof value === "string") {
    acc.push({ entry: entryName, target: value });
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const label = `${entryName} (${key})`;
      collectPaths(label, nested, acc);
    }
  }
}

const exportsMap = pkg.exports;
if (!exportsMap || typeof exportsMap !== "object") {
  fail("package.json has no `exports` map to verify.");
}

const referenced = [];
for (const [entryName, entryValue] of Object.entries(exportsMap)) {
  collectPaths(entryName, entryValue, referenced);
}

if (referenced.length === 0) {
  fail("the `exports` map does not reference any files.");
}

const missing = [];
for (const { entry, target } of referenced) {
  const rel = target.replace(/^\.\//, "");
  const abs = resolve(packageRoot, rel);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    missing.push({ entry, target, abs });
  }
}

if (missing.length > 0) {
  const details = missing
    .map((m) => `  - ${m.entry}: "${m.target}" -> ${m.abs} (NOT FOUND)`)
    .join("\n");
  fail(
    `the following exports-map paths do not resolve to files in the package:\n${details}`
  );
}

console.log(
  `\u2713 exports map: all ${referenced.length} referenced path(s) exist in the package.`
);

// ---------------------------------------------------------------------------
// 2. Run `npm pack --dry-run --json` and inspect the packed file set
// ---------------------------------------------------------------------------
let packOutput;
try {
  // Run through a shell so `npm` (and its .cmd shim on Windows) resolves
  // correctly. Node forbids spawning .cmd files without a shell.
  packOutput = execSync("npm pack --dry-run --json", {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  const stdout = err.stdout ? String(err.stdout) : "";
  const stderr = err.stderr ? String(err.stderr) : "";
  fail(`\`npm pack --dry-run --json\` failed: ${err.message}\n${stderr || stdout}`);
}

let packJson;
try {
  // npm may emit warnings before the JSON payload; slice from the first bracket.
  const start = packOutput.indexOf("[");
  const jsonText = start >= 0 ? packOutput.slice(start) : packOutput;
  packJson = JSON.parse(jsonText);
} catch (err) {
  fail(`unable to parse \`npm pack\` JSON output: ${err.message}`);
}

const entry = Array.isArray(packJson) ? packJson[0] : packJson;
const files = (entry && entry.files) || [];
if (files.length === 0) {
  fail("`npm pack --dry-run --json` reported no files in the artifact.");
}

// Normalize packed file paths to forward-slash, package-relative form.
const packedPaths = files.map((f) =>
  normalize(f.path).split(sep).join("/").replace(/^\.\//, "")
);

const FORBIDDEN_CONFIG_FILES = new Set([
  "tsconfig.json",
  "tsup.config.ts",
  "vitest.config.ts",
]);

const forbidden = [];
for (const p of packedPaths) {
  const lower = p.toLowerCase();
  if (p === "src" || p.startsWith("src/")) {
    forbidden.push({ path: p, reason: "source directory (src/) must not be published" });
  } else if (p === "node_modules" || p.startsWith("node_modules/")) {
    forbidden.push({ path: p, reason: "node_modules/ must not be published" });
  } else if (FORBIDDEN_CONFIG_FILES.has(p)) {
    forbidden.push({ path: p, reason: "configuration file must not be published" });
  } else if (lower.endsWith(".log")) {
    forbidden.push({ path: p, reason: "log file must not be published" });
  }
}

if (forbidden.length > 0) {
  const details = forbidden
    .map((f) => `  - "${f.path}": ${f.reason}`)
    .join("\n");
  fail(`the pack artifact includes files that must be excluded:\n${details}`);
}

console.log(
  `\u2713 pack contents: ${packedPaths.length} file(s), none forbidden (no src/, node_modules/, config, or .log).`
);

// ---------------------------------------------------------------------------
// 3. Success
// ---------------------------------------------------------------------------
console.log("\n\u2713 verify-pack passed: package is ready to publish.\n");
process.exit(0);
