---
name: add-cli-command
description: Add a New CLI Command
---

# Add a New CLI Command

## CLI Command Structure (Commander.js)

- Use **Commander.js** for all CLI argument parsing. No other argument parsers.
- **Command definitions** live in `src/cli.tsx`: `.command()`, `.description()`, `.option()`, `.action()`.
- **Execution logic** lives in `src/commands/<name>.ts` as exported async functions.
- Action handlers in `src/cli.tsx` must only: extract options, determine TUI vs CLI mode, then delegate to execution
  functions. No business logic in action handlers.
- Execution functions in `src/commands/` must **not** import Commander — they must be callable by both CLI action
  handlers and TUI components without modification.
- Global options (e.g. `--config-dir`, `--no-tui`) are defined on the root `program` only. Per-command options are
  defined on their respective subcommands only.

1. Create `src/commands/<name>.ts`:
   - Export `async function run<Name>(options, configDir?: string): Promise<void>`
   - Do **not** import Commander
   - Accept `configDir?: string` when config/credentials are needed

2. Register in `src/cli.tsx`:
   ```ts
   program
     .command('mycommand')
     .description('...')
     .option('--my-flag', '...')
     .action(async (options, command: Command) => {
       const globalOptions = command.parent!.opts<GlobalOptions>();
       const { configDir } = globalOptions;
       if (isTuiMode(globalOptions)) {
         render(<MyComponent configDir={configDir} />);
       } else {
         await runMyCommand(options, configDir);
       }
     });
   ```

3. If the command has a TUI view, create `src/components/<Name>.tsx`:
   - Call the same execution functions from `src/commands/` — no logic duplication
   - Use Ink primitives (`Box`, `Text`, `useApp`, `useInput`, `useEffect`, `useState`)
   - Never import React

## TUI vs CLI mode

`isTuiMode(globalOptions)` returns true when `--tui` (default) **and** `process.stdout.isTTY`.
- TUI: `render(<Component />)` via Ink
- CLI: plain `console.log`

Sub-command parent traversal:
- Direct child of `program`: `command.parent!.opts<GlobalOptions>()`
- Grandchild (e.g. `config show`): `command.parent!.parent!.opts<GlobalOptions>()`
