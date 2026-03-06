# Code Conventions

## Language

- Always use TypeScript. No plain JavaScript files.
- Never import `React` directly (JSX transform handles it).
- Use `.js` extensions in all imports (ESM requirement), even for `.ts` source files.

## Schema Definitions

- Use Zod for all schemas — API responses, user input, config files, CLI arguments.
- Derive TypeScript types from Zod schemas via `z.infer<>` rather than defining types separately.

## Code Organization

- One concern per file; group related files under `src/`.
- Avoid large monolithic files; split by feature, layer, or responsibility.

## Gotchas

- **`execSync` cast**: Agent checkers use `execSync as unknown as Executor` to keep the injectable interface narrow.
- **Verbose logging**: `--verbose` or `AITOOL_VERBOSE=1`; output goes to `stderr`.
- **`src/app.tsx`**: Unused scaffolding placeholder — ignore it.
- **Token refresh buffer**: `runTokenRefresh` refreshes 30 min before expiry (`TOKEN_REFRESH_BUFFER_MS`).
- **Runtime**: Bun (not Node). Only `src/update.ts` uses Bun-specific APIs — keep Node built-ins everywhere else.
