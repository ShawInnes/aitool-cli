# aitool

CLI for AI coding agent management, distributed as compiled platform binaries.

## Commands

- `bun run dev` — watch mode
- `bun run build:all` — compile binaries for all platforms
- `bun run release` — bump patch version and tag

## Rules

- [conventions.md](.claude/rules/conventions.md) — TypeScript, Zod, ESM imports, gotchas
- [tui.md](.claude/rules/tui.md) — three-layer TUI pattern (command/component/CLI) and color conventions
- [workflow.md](.claude/rules/workflow.md) — planning, subagents, verification, elegance

## Verification

After making changes:

- `bun run test` — run tests
- `bun run lint` — prettier + xo lint check

## Git Commits

After completing any implementation, create a git commit automatically:

- Stage all relevant modified/new files
- Message pattern: `type: short description` (e.g. `feat: add agent configure command`)
- Do not wait to be asked — commit as the final step of every task

## Decisions

**Skills git operations use `spawnSync`, not isomorphic-git.**
`skillsInstall.ts` and `skillsUpdate.ts` use `spawnSync('git', [...])`. This is intentional — do not replace with isomorphic-git. Reasons: isomorphic-git has no SSH transport (SSH clone URLs break), `pull` requires knowing the branch name upfront, it adds ~500KB to the bundle, and system git picks up SSH keys/credential helpers automatically. This CLI targets developers where git is always present.
