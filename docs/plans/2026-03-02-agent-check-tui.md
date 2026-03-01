# AgentCheck TUI Component Plan

**Date:** 2026-03-02
**Goal:** Add a rich Ink TUI component for `aitool agent check` with colored status indicators (green ✓ / red ✗), a title, and a border. Establish and document the canonical pattern for all rich command output in this project.

---

## Background

The `agent check` command currently uses plain `console.log` with no color. The project already has rich Ink components for other commands (`AuthStatus`, `AgentInstall`, `AgentConfigure`) but no documented architectural pattern governing when and how to create them.

---

## Task 1: Write plan file

**File:** `docs/plans/2026-03-02-agent-check-tui.md` _(this file)_

---

## Task 2: Create `src/components/AgentCheck.tsx`

**File:** `src/components/AgentCheck.tsx` (new)

Follows the established component pattern used by `AuthStatus` and `AgentInstall`:

- Title: `aitool — Agent Check` (bold, consistent with `AuthStatus`)
- Single-border box around all results (consistent with `AuthStatus`)
- Per-agent row: display name (padded), colored status, detail (version/path/error in gray)
- Green `✓ installed` / red `✗ not installed`
- `useEffect` + `setTimeout(() => exit(), 100)` for graceful exit

```tsx
// src/components/AgentCheck.tsx
import {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {type AgentCheckSummary} from '../commands/agentCheck.js';

type Props = {
	readonly results: AgentCheckSummary[];
};

function StatusRow({result}: {readonly result: AgentCheckSummary}) {
	const detail = result.version
		? ` (${result.version})`
		: result.path
			? ` (${result.path})`
			: result.error
				? ` — ${result.error}`
				: '';

	return (
		<Box gap={1}>
			<Text color="gray">{result.displayName.padEnd(14)}</Text>
			{result.installed ? (
				<Text color="green">✓ installed</Text>
			) : (
				<Text color="red">✗ not installed</Text>
			)}
			{detail ? <Text color="gray">{detail}</Text> : null}
		</Box>
	);
}

export default function AgentCheck({results}: Props) {
	const {exit} = useApp();

	useEffect(() => {
		const timer = setTimeout(() => {
			exit();
		}, 100);
		return () => {
			clearTimeout(timer);
		};
	}, [exit]);

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>aitool — Agent Check</Text>
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
				{results.map(r => (
					<StatusRow key={r.id} result={r} />
				))}
			</Box>
		</Box>
	);
}
```

---

## Task 3: Update `src/commands/agentCheck.ts`

**Changes:**

1. Add `silent?: boolean` to `AgentCheckOptions` — suppresses plain-text when TUI will render
2. Change return type from `Promise<void>` to `Promise<AgentCheckSummary[]>`
3. Return the results array in all non-exit paths
4. Skip plain-text loop when `silent: true`

```ts
export type AgentCheckOptions = {
	agent?: string;
	json?: boolean;
	silent?: boolean; // suppress plain-text; caller will render TUI
};

export async function runAgentCheck(
	options: AgentCheckOptions = {},
): Promise<AgentCheckSummary[]> {
	const {agent: agentId, json = false, silent = false} = options;
	// ... existing agent selection ...
	const results = await Promise.all(/* ... */);

	if (json) {
		console.log(JSON.stringify(results, null, 2));
		return results;
	}

	if (!silent) {
		for (const r of results) {
			/* plain-text loop */
		}
	}

	return results;
}
```

---

## Task 4: Wire component in `src/cli.tsx`

**Changes:**

1. Import `AgentCheck` from `./components/AgentCheck.js`
2. In the `agent check` action, detect TUI mode and conditionally render

```tsx
.action(async (agentId: string | undefined, options: {json?: boolean}) => {
  const globalOptions = (agentCommand.parent as typeof program).opts<GlobalOptions>();
  const tui = !options.json && isTuiMode(globalOptions);
  const results = await runAgentCheck({
    agent: agentId,
    json: options.json,
    silent: tui,
  });
  if (tui) {
    const {waitUntilExit} = render(<AgentCheck results={results} />);
    await waitUntilExit();
  }
});
```

---

## Task 5: Update architecture rules in `CLAUDE.md` and `AGENTS.md`

Add a **"TUI Components and Rich Output"** section documenting:

- The three-layer pattern: command → component → CLI wiring
- When to use `silent` and how TUI detection works
- Color conventions table (green/red/yellow/gray/cyan/bold)
- List of existing examples

---

## Task 6: Run tests and commit

```bash
bun test tests/
git add ...
git commit -m "feat: add AgentCheck TUI component with colored status and architecture rules"
```

---

## Color Conventions (established by this plan)

| Situation                   | Color    | Example                                       |
| --------------------------- | -------- | --------------------------------------------- |
| Success / Installed / Valid | `green`  | `<Text color="green">✓ installed</Text>`      |
| Error / Not Found / Expired | `red`    | `<Text color="red">✗ not installed</Text>`    |
| Warning / Expiring          | `yellow` | `<Text color="yellow">⚠ expiring soon</Text>` |
| Labels / Metadata           | `gray`   | `<Text color="gray">version</Text>`           |
| URLs / Emphasized Values    | `cyan`   | `<Text color="cyan">https://...</Text>`       |
| Titles                      | `bold`   | `<Text bold>aitool — Agent Check</Text>`      |
