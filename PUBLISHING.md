# Publishing `inletbase`

This document describes the repeatable process for publishing the `inletbase`
package to the [npm registry](https://www.npmjs.com/). Follow it for every
release so that each version is authenticated, built cleanly, versioned
correctly, and verified after it goes live.

The current package name is **`inletbase`** — an **unscoped** name. Notes that
apply only to scoped names (for example `@byteonic/inletbase`) are called out
explicitly.

---

## Before you publish

Complete these checks once per release, before running the four publish steps.

### 1. Verify the package name is available

The publish target name must be free on the registry (for a first release) or
owned by the account you authenticate with (for subsequent releases). Check it:

```bash
# Inspect the published package metadata (if it exists at all)
npm view inletbase

# Or search the registry
npm search inletbase
```

- If `npm view inletbase` returns **404 / "npm ERR! code E404"**, the name is
  unused and available to claim.
- If it returns metadata for a package **you own**, you can publish new
  versions to it.
- If it returns metadata for a package owned by **another account**, publishing
  is **blocked**. Do not attempt to force it. Choose a different unscoped name,
  or move to a scope you own (for example `@your-scope/inletbase`) by updating
  the `name` field in `package.json` before continuing.

### 2. Confirm the working tree is release-ready

Make sure the code you intend to ship is committed, the changelog/README are
updated, and there are no stray local changes.

---

## The Publish Process — four ordered steps

Run these four steps **in order**. Do not skip or reorder them.

### Step 1 — Authenticate to npm

You must be authenticated before you can publish. Log in and confirm the active
account:

```bash
npm login
npm whoami
```

- `npm login` prompts for your npm username, password, and one-time code (if
  2FA is enabled). Authentication **must succeed** before proceeding.
- `npm whoami` prints the currently authenticated user. If it errors or prints
  the wrong account, resolve authentication before moving on — **do not
  continue to publish while unauthenticated.**

### Step 2 — Bump the version

Choose the correct Semantic Versioning increment (see
[Versioning policy](#versioning-policy-semver) below) and apply it with
`npm version`:

```bash
# Pick exactly one:
npm version patch   # backward-compatible bug fixes
npm version minor   # backward-compatible new features
npm version major   # breaking changes
```

`npm version` updates the `version` field in `package.json`, creates a git
commit, and tags the commit. Confirm the new version is what you intended before
publishing:

```bash
npm pkg get version
```

### Step 3 — Build

Produce a fresh, clean build of the distributable artifacts:

```bash
npm run build
```

This runs `tsup` and emits the CommonJS, ES module, and type-declaration outputs
into `dist/` for all three entry points (`.`, `./react`, `./server`).

**Clean-build gate:** the publish step is blocked unless the build is clean. If
`npm run build` exits non-zero or reports errors, **stop** and fix the errors
before publishing. A failing build must never be published.

### Step 4 — Publish

Publish the built package to the registry:

```bash
npm publish
```

For the **unscoped** `inletbase` name, plain `npm publish` publishes publicly.

> **Scoped names require `--access public`.** Scoped packages default to
> _restricted_ (private) access, which is not installable by the public. If you
> switch to a scoped name (for example `@byteonic/inletbase`), you must publish
> with:
>
> ```bash
> npm publish --access public
> ```
>
> so the package is publicly installable.

**Automatic prepublish gate:** `npm publish` automatically runs the
`prepublishOnly` hook first:

```json
"prepublishOnly": "npm run build && node scripts/verify-pack.mjs"
```

This rebuilds the package and runs `scripts/verify-pack.mjs`, which:

1. Confirms every path referenced by the `exports` map (`import`, `require`,
   `types`) resolves to a real file in the package.
2. Runs `npm pack --dry-run --json` and asserts the packed file set excludes
   `src/`, `node_modules/`, config files, and `.log` files.

If either the build or `verify-pack` fails (non-zero exit), the publish is
aborted before anything is uploaded.

---

## After you publish — verify the release

Confirm the published version is retrievable from the registry and matches the
version you intended to ship:

```bash
# Confirm the latest published version matches your bump
npm view inletbase version

# Confirm the specific version you just published is retrievable
npm view inletbase@<version>
```

Replace `<version>` with the version produced in Step 2 (for example
`npm view inletbase@1.0.1`). Both commands must succeed and report the intended
version. If the reported version does not match, the release did not complete as
expected — investigate before announcing the release.

---

## Versioning policy (SemVer)

`inletbase` follows [Semantic Versioning](https://semver.org/):
**`MAJOR.MINOR.PATCH`**. Pick the increment based on the nature of the changes
in the release:

| Increment | Command             | When to use                                                                 |
| --------- | ------------------- | --------------------------------------------------------------------------- |
| **MAJOR** | `npm version major` | Breaking changes — any change that is **not** backward compatible.          |
| **MINOR** | `npm version minor` | Backward-compatible **new features** or additions.                          |
| **PATCH** | `npm version patch` | Backward-compatible **bug fixes** with no API changes.                      |

- Increment **MAJOR** when you make incompatible API changes.
- Increment **MINOR** when you add functionality in a backward-compatible way.
- Increment **PATCH** when you make backward-compatible bug fixes.

---

## If publishing fails

Publishing is designed to be safe to retry. If `npm publish` fails for any
reason (network error, failed `prepublishOnly` gate, authentication problem,
name conflict):

- npm surfaces the error and **no partial release occurs** — a version is only
  ever fully published or not at all. There is no half-published state to clean
  up.
- Read the surfaced error message and address the root cause:
  - **Not authenticated / wrong account** → redo [Step 1](#step-1--authenticate-to-npm).
  - **Build or verify-pack failure** → fix the reported issue and rebuild
    ([Step 3](#step-3--build)).
  - **Name owned by another account** → choose a different name or scope you
    own (see [Verify the package name is available](#1-verify-the-package-name-is-available)).
- Once the cause is fixed, **re-run the process safely.** If the version bump in
  Step 2 already succeeded (commit and tag created) but publish failed, you do
  **not** need to bump again — simply re-run [Step 4](#step-4--publish) after
  resolving the failure. Only bump again if you changed code after the failure.

---

## Quick reference

```bash
# Pre-checks
npm view inletbase            # name availability / ownership

# 1. Authenticate
npm login
npm whoami

# 2. Bump version (choose one)
npm version patch | minor | major

# 3. Build (clean-build gate)
npm run build

# 4. Publish (add --access public for SCOPED names)
npm publish
# npm publish --access public   # scoped names only

# Post-publish verification
npm view inletbase version
npm view inletbase@<version>
```
