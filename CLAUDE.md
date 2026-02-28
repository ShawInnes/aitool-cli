# Development Rules

## Language

- Always use **TypeScript**. No plain JavaScript files.

## Schema Definitions

- Use **Zod** for all schema definitions, especially for data coming from external sources (API responses, user input, config files, CLI arguments).
- Derive TypeScript types from Zod schemas using `z.infer<>` rather than defining types separately.

## Code Organization

- Keep code separated into **logical files** — one concern per file.
- Group related functionality into modules under `src/`.
- Avoid large monolithic files; split by feature, layer, or responsibility.

## CLI Command Structure (Commander.js)

- Use **Commander.js** for all CLI argument parsing. No other argument parsers.
- **Command definitions** live in `src/cli.tsx`: `.command()`, `.description()`, `.option()`, `.action()`.
- **Execution logic** lives in `src/commands/<name>.ts` as exported async functions.
- Action handlers in `src/cli.tsx` must only: extract options, determine TUI vs CLI mode, then delegate to execution functions. No business logic in action handlers.
- Execution functions in `src/commands/` must **not** import Commander — they must be callable by both CLI action handlers and TUI components without modification.
- Global options (e.g. `--config-dir`, `--no-tui`) are defined on the root `program` only. Per-command options are defined on their respective subcommands only.
