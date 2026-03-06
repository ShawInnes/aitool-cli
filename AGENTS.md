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

## TUI Components and Rich Output

Every command that produces human-readable output **must** follow this three-layer pattern:

### 1. Command layer (`src/commands/*.ts`)

- Returns structured data — never renders directly
- Accepts `silent?: boolean` to suppress plain-text when a TUI component will render instead
- Accepts `json?: boolean` for JSON output (independent of TUI mode)
- Plain-text fallback prints if `!silent && !json`

### 2. Component layer (`src/components/*.tsx`)

- One Ink component per command, receiving data as props (no fetching)
- Always includes a bold title: `<Text bold>aitool — {Command Name}</Text>`
- Wraps content in a single-border box: `<Box borderStyle="single" borderColor="gray" paddingX={1}>`
- Calls `useApp().exit()` via `useEffect` + `setTimeout(..., 100)` to flush output and return to the shell
- Never imports `React` directly (project rule)

### 3. CLI layer (`src/cli.tsx`)

- Detects TUI mode: `const tui = !options.json && isTuiMode(globalOptions)`
- Calls the command with `silent: tui` to avoid double-printing
- If `tui`: renders component and `await waitUntilExit()`
- If not `tui`: command already printed plain-text or JSON

### Color conventions

| Situation                   | Color    | Example                                       |
| --------------------------- | -------- | --------------------------------------------- |
| Success / Installed / Valid | `green`  | `<Text color="green">✓ installed</Text>`      |
| Error / Not Found / Expired | `red`    | `<Text color="red">✗ not installed</Text>`    |
| Warning / Expiring soon     | `yellow` | `<Text color="yellow">⚠ expiring soon</Text>` |
| Labels / Metadata           | `gray`   | `<Text color="gray">version</Text>`           |
| URLs / Emphasized values    | `cyan`   | `<Text color="cyan">https://…</Text>`         |
| Section titles              | `bold`   | `<Text bold>aitool — Agent Check</Text>`      |

### Existing examples

- `AgentCheck` — colored ✓/✗ per agent, bordered list
- `AgentInstall` — install URL + per-platform commands
- `AgentConfigure` — diff tree with color-coded changes
- `AuthStatus` — token validity with green/red/yellow indicators

---

## Essential Commands

| Purpose              | Command             |
| -------------------- | ------------------- |
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
| -------- | ------------------------------------------------- |
| macOS    | `~/Library/Application Support/aitool/`           |
| Linux    | `$XDG_CONFIG_HOME/aitool/` or `~/.config/aitool/` |
| Windows  | `%APPDATA%\aitool\`                               |

Files: `config.json` and `credentials.json`, both `0o600`. Override with `--config-dir`.

---

## Git Commits

After completing any implementation (new feature, bug fix, refactor), create a git commit automatically:

- Stage all modified and new files relevant to the change
- Write a concise commit message following the pattern: `type: short description` (e.g. `feat: add agent configure command`)
- Do **not** wait to be asked — commit as the final step of every implementation task

---

## Gotchas

- **`.js` imports**: TypeScript source uses `.js` extensions in all imports (ESM requirement).
- **`execSync` cast**: Agent checkers use `execSync as unknown as Executor` to keep the injectable interface narrow.
- **Verbose logging**: `--verbose` or `AITOOL_VERBOSE=1`; output goes to `stderr`.
- **`src/app.tsx`**: Unused scaffolding placeholder — ignore it.
- **Token refresh buffer**: `runTokenRefresh` refreshes 30 min before expiry (`TOKEN_REFRESH_BUFFER_MS`).
