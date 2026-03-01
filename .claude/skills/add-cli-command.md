# Add a New CLI Command

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
