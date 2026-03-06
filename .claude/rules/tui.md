# TUI Components and Rich Output

Every command that produces human-readable output must follow this three-layer pattern:

## 1. Command layer (`src/commands/*.ts`)

- Returns structured data — never renders directly
- Accepts `silent?: boolean` to suppress plain-text when a TUI component will render
- Accepts `json?: boolean` for JSON output (independent of TUI mode)
- Plain-text fallback prints if `!silent && !json`

## 2. Component layer (`src/components/*.tsx`)

- One Ink component per command, receiving data as props (no fetching)
- Always includes a bold title: `<Text bold>aitool — {Command Name}</Text>`
- Wraps content in a single-border box: `<Box borderStyle="single" borderColor="gray" paddingX={1}>`
- Calls `useApp().exit()` via `useEffect` + `setTimeout(..., 100)` to flush output
- Never imports `React` directly

## 3. CLI layer (`src/cli.tsx`)

- Detects TUI mode: `const tui = !options.json && isTuiMode(globalOptions)`
- Calls command with `silent: tui` to avoid double-printing
- If `tui`: renders component and `await waitUntilExit()`

## Color conventions

| Situation                   | Color    |
| --------------------------- | -------- |
| Success / Installed / Valid | `green`  |
| Error / Not Found / Expired | `red`    |
| Warning / Expiring soon     | `yellow` |
| Labels / Metadata           | `gray`   |
| URLs / Emphasized values    | `cyan`   |
| Section titles              | `bold`   |
