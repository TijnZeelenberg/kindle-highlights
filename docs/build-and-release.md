# Build, Release & Operations — obsidian-kindle-plugin

## Build & Test

| Command                | Purpose         | Expected                                                  |
| ---------------------- | --------------- | --------------------------------------------------------- |
| `npm install`          | Install deps    | Clean (some deprecation warnings OK)                      |
| `npm run lint`         | ESLint          | 0 errors required. Warnings acceptable (32 as of v2.0.0)  |
| `npm run test`         | Jest tests      | All pass (112 tests, 12 suites as of v2.0.0)              |
| `npm run test-verbose` | Jest verbose    | Same as above with detail                                 |
| `npm run build`        | esbuild → dist/ | Produces `dist/main.js` (~750KB) and `dist/manifest.json` |

- **Pre-commit hooks**: lint-staged runs on staged files. Will reject commits with lint errors. Never bypass with `--no-verify`.
- **Node version**: 20.x (local and CI). Older Node versions (15, 19) break with modern deps.

## Versioning

Three files must be updated together for any version bump:

1. `package.json` — `version` field
2. `manifest.json` — `version` field
3. `versions.json` — add entry mapping version → minAppVersion

`manifest.json` also contains `minAppVersion` (currently `0.10.2` — should be updated in a future session).

## Release Process

1. Ensure lint/test/build all pass locally
2. Bump version in all three files (see above)
3. Commit, push to master
4. `git tag <version> && git push origin <version>`
5. Create GitHub release: `gh release create <version> --title "..." --notes "..."`
6. Release workflow (`.github/workflows/releases.yml`) triggers on `release: [published]`
7. Workflow builds and uploads: `main.js`, `manifest.json`, `obsidian-kindle-plugin.zip`
8. Obsidian's community plugin registry picks up the new release automatically

## Local Testing in Obsidian

Copy built artifacts into a vault's plugin directory:

```bash
VAULT="/Users/hosman/Documents/Test Vault/Test Vault"
PLUGIN_DIR="$VAULT/.obsidian/plugins/obsidian-kindle-plugin"
mkdir -p "$PLUGIN_DIR"
cp dist/main.js dist/manifest.json "$PLUGIN_DIR/"
```

Then restart Obsidian (or toggle the plugin off/on in Settings → Community Plugins).

To test release artifacts specifically:

```bash
gh release download <version> --pattern 'main.js' --pattern 'manifest.json' --dir /tmp/kindle-release --clobber
cp /tmp/kindle-release/* "$PLUGIN_DIR/"
```

## Git Conventions

- **Merge strategy**: `--no-ff` for all PR merges (preserves history)
- **Integration branches**: For large batch work (3+ PRs), use an integration branch (e.g., `revival/v2.0.0`) and merge to master only after full verification
- **Branch protection**: Rules exist on master (require PR) but owner can bypass
- **Commit messages**: Conventional-ish. Prefixes: `fix:`, `feat:`, `chore:`, `ci:`

## CI/CD

- **CI** (`.github/workflows/main.yml`): Runs on PRs to master. Lint + test only.
- **Release** (`.github/workflows/releases.yml`): Runs on release published. Full build + asset upload.
- Both use Node 20, `actions/checkout@v4`, `actions/setup-node@v4`
- Release uses `softprops/action-gh-release@v2` for asset uploads

## GitHub Auth

The repo owner's SSH key authenticates as `hadynz`. The `gh` CLI may be authenticated as a different account (`hosman-nz`).

- **Git operations** (push, pull, fetch) use SSH → works as `hadynz`
- **GitHub API** (`gh` CLI) uses OAuth token → may be `hosman-nz`

If `gh` API calls return 404/403:

1. `gh auth status` — check active account
2. `gh auth switch` — switch to `hadynz`

**Always verify at session start** which account `gh` is using, especially before releases or PR operations.
