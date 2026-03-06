---
name: release
description: Use when releasing a new version of aitool-cli to production
---

# Release

Releases are driven by git tags. Pushing a `v*` tag triggers the GitHub Actions release workflow, which builds all platform binaries and publishes a GitHub Release.

## Process

1. Ensure `main` is clean and all changes are committed and pushed.
2. Bump the version and create a tag:

```sh
bun run release          # patch bump (1.4.1 → 1.4.2)
bun run release:minor    # minor bump (1.4.1 → 1.5.0)
bun run release:major    # major bump (1.4.1 → 2.0.0)
```

3. Push the commit and tag together:

```sh
git push origin main --tags
```

That's it. The CI release workflow handles the rest.

## What `bun run release` does

Runs `npm version patch --message 'chore: release v%s'`, which:
- Bumps the version in `package.json`
- Creates a commit with message `chore: release vX.Y.Z`
- Creates an annotated git tag `vX.Y.Z`

## Common mistakes

| Mistake | Fix |
| --- | --- |
| `git push` without `--tags` | Tag never reaches remote; CI never fires. Always use `--tags`. |
| Running release on a dirty tree | Commit or stash changes first. |
| Pushing the tag before `main` | Push both together: `git push origin main --tags`. |
