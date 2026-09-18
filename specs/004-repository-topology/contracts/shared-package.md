# Contract: Shared Frontend Packages

## Package set

| Package | Owns | First consumers |
| --- | --- | --- |
| `@241/ui` | Reusable Vue UI components and UI utilities | All web apps that use shared UI |
| `@241/web-shared` | API transport helpers, common composables, shared constants, error handling | All web apps |
| `@241/reference-data` | Not active in current baseline | None; `admission-web` does not contain this package |

## Package manifest requirements

Each package MUST have:

- a lowercase scoped name;
- an independent semantic `version`;
- `type: module`;
- an explicit `exports` map;
- a `files` allowlist that excludes tests, fixtures, credentials, and local
  configuration;
- a `repository` field pointing to `241-web-packages`;
- package-local typecheck and test scripts;
- declared runtime dependencies;
- Vue and other application singletons as peer dependencies where appropriate;
- no import of consumer aliases such as `@/ui` or `@/shared`.

## Consumer requirements

Web repositories MUST:

- declare `@241/ui` and `@241/web-shared` only when used;
- resolve packages from GitHub Packages through a scoped `.npmrc` mapping;
- pin or tightly bound versions in `package.json` and commit the lockfile;
- update package versions through a normal pull request;
- avoid retaining a copied source tree for a package it consumes;
- keep app-specific `packages/platform` source local.

The existing `@/ui` and `@/shared` aliases may remain as
compatibility aliases in a web app only if they resolve to the installed package
exports. They must not resolve to a sibling repository or a copied source tree.

## Release rules

| Change | Version |
| --- | --- |
| Internal fix with unchanged public exports and behavior | patch |
| New optional export or compatible component/utility | minor |
| Removed/renamed export or incompatible behavior | major |

A package release does not automatically release or redeploy consumers. A
consumer adopts it through its own dependency update and release.

## Registry contract

```text
registry: https://npm.pkg.github.com
scope: @241
```

Workflows use `GITHUB_TOKEN` with `packages: write` when publishing from the
package repository. Consumer workflows use a package read permission granted to
the repository by GitHub Packages access control. No token is committed in
`.npmrc` or `package.json`.

## Verification

The package repository MUST verify:

1. package exports resolve from a clean consumer fixture;
2. `pnpm pack` contains only the declared package files;
3. package typecheck and tests pass;
4. a patch release can be adopted by one consumer without changing another
   consumer's installed version;
5. a major release fails a fixture that still imports the removed public export.
