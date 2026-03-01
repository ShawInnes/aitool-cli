# Development Rules

## External File Loading

CRITICAL: When you encounter a file reference (e.g., @rules/general.md), use your Read tool to load it on a need-to-know basis. They're relevant to the SPECIFIC task at hand.

Instructions:

- Do NOT preemptively load all references - use lazy loading based on actual need
- When loaded, treat content as mandatory instructions that override defaults
- Follow references recursively when needed

## Language

- Always use **TypeScript**. No plain JavaScript files.
- Never import 'React'

## Schema Definitions

- Use **Zod** for all schema definitions, especially for data coming from external sources (API responses, user input,
  config files, CLI arguments).
- Derive TypeScript types from Zod schemas using `z.infer<>` rather than defining types separately.

## Code Organization

- Keep code separated into **logical files** — one concern per file.
- Group related functionality into modules under `src/`.
- Avoid large monolithic files; split by feature, layer, or responsibility.

---

## Essential Commands

| Purpose              | Command             |
|----------------------|---------------------|
| Dev (watch mode)     | `bun run dev`       |
| Run directly         | `bun run start`     |
| Build all platforms  | `bun run build:all` |
| Lint (prettier + xo) | `bun run lint`      |
| Run tests            | `bun run test`      |
| Release patch        | `bun run release`   |

**Runtime**: Bun (not Node). Only `src/update.ts` uses Bun-specific APIs — keep Node built-ins everywhere else.

---

## Project Overview

`aitool` is a CLI for corporate OIDC authentication and AI coding agent management, distributed as compiled
platform binaries (`bun build --compile`).

### Directory Structure

```
src/
  cli.tsx             # Entry point — command definitions only
  update.ts           # Self-update (Bun-specific APIs)
  commands/           # Execution functions, one file per command
  components/         # Ink TUI components
  agents/             # Agent checker framework + registry
    agent.ts          # AgentChecker interface
    index.ts          # AGENT_REGISTRY
  config/
    paths.ts          # Platform-aware storage paths
    schemas.ts        # All Zod schemas
    store.ts          # Read/write config.json + credentials.json
    discovery.ts      # OIDC discovery fetching/caching
  tests/
    agents_spec.ts    # Bun tests
docs/AGENTS.md        # AI agent registry table (unrelated to this file)
```

### Config storage paths

| Platform | Path                                              |
|----------|---------------------------------------------------|
| macOS    | `~/Library/Application Support/aitool/`           |
| Linux    | `$XDG_CONFIG_HOME/aitool/` or `~/.config/aitool/` |
| Windows  | `%APPDATA%\aitool\`                               |

Files: `config.json` and `credentials.json`, both `0o600`. Override with `--config-dir`.

---

## Gotchas

- **`.js` imports**: TypeScript source uses `.js` extensions in all imports (ESM requirement).
- **`execSync` cast**: Agent checkers use `execSync as unknown as Executor` to keep the injectable interface narrow.
- **Verbose logging**: `--verbose` or `AITOOL_VERBOSE=1`; output goes to `stderr`.
- **`src/app.tsx`**: Unused scaffolding placeholder — ignore it.
- **Token refresh buffer**: `runTokenRefresh` refreshes 30 min before expiry (`TOKEN_REFRESH_BUFFER_MS`).

