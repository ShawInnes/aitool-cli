# Agent List Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `aitool agent list` that shows a two-column table of supported AI coding agents (ID + Name), rendered as a TUI with Ink or plain text fallback.

**Architecture:** Follows the established `isTuiMode()` → `render(<Component />)` / `console.log` pattern from `auth status`. Business logic in `src/commands/agentList.ts`, Ink component in `src/components/AgentList.tsx`, CLI wiring in `src/cli.tsx`. Data comes directly from the existing `AGENT_REGISTRY`.

**Tech Stack:** TypeScript, Ink (React), `bun:test`, `ink-testing-library`, Commander.js

---

## Task 1: `runAgentList()` command function + tests

**Files:**
- Create: `src/commands/agentList.ts`
- Create: `test-agent-list.ts`

**Step 1: Write the failing test first**

Create `test-agent-list.ts` in the project root:

```typescript
// test-agent-list.ts
import {describe, expect, test} from 'bun:test';
import {AGENT_REGISTRY} from './src/agents/index.js';

// Import will fail until we create the module — that's expected
import {runAgentList} from './src/commands/agentList.js';

describe('runAgentList', () => {
	test('prints a header row', () => {
		const lines: string[] = [];
		runAgentList(line => lines.push(line));
		const header = lines[0] ?? '';
		expect(header).toContain('ID');
		expect(header).toContain('Name');
	});

	test('prints one row per registered agent', () => {
		const lines: string[] = [];
		runAgentList(line => lines.push(line));
		// header + separator + one row per agent
		expect(lines.length).toBe(2 + AGENT_REGISTRY.length);
	});

	test('each agent row contains its id and displayName', () => {
		const lines: string[] = [];
		runAgentList(line => lines.push(line));
		for (const agent of AGENT_REGISTRY) {
			const row = lines.find(l => l.includes(agent.id));
			expect(row).toBeDefined();
			expect(row).toContain(agent.displayName);
		}
	});
});
```

**Step 2: Run to confirm it fails**

Run: `bun test ./test-agent-list.ts 2>&1 | head -10`
Expected: error importing `./src/commands/agentList.js` (module doesn't exist yet)

**Step 3: Create `src/commands/agentList.ts`**

```typescript
// src/commands/agentList.ts
import {AGENT_REGISTRY} from '../agents/index.js';

const COL_ID = 14;

/**
 * Prints a plain-text two-column table of all registered AI coding agents.
 *
 * Output format:
 *   ID             Name
 *   ─────────────  ──────────
 *   claude-code    Claude Code
 *   opencode       Open Code
 *
 * @param print - injectable output function, defaults to console.log.
 *                Accepts one line at a time for testability.
 */
export function runAgentList(print: (line: string) => void = console.log): void {
	print(`${'ID'.padEnd(COL_ID)} Name`);
	print(`${'─'.repeat(COL_ID)} ${'─'.repeat(10)}`);
	for (const agent of AGENT_REGISTRY) {
		print(`${agent.id.padEnd(COL_ID)} ${agent.displayName}`);
	}
}
```

**Step 4: Run tests — expect all pass**

Run: `bun test ./test-agent-list.ts 2>&1`
Expected: 3 tests pass

**Step 5: Check prettier**

Run: `npx prettier --check src/commands/agentList.ts`
If it fails: `npx prettier --write src/commands/agentList.ts`

**Step 6: Build check**

Run: `bun run build:darwin-arm64 2>&1 | head -5`
Expected: clean build

**Step 7: Commit**

```bash
git add src/commands/agentList.ts test-agent-list.ts
git commit -m "feat(agent): add runAgentList command function with tests"
```

---

## Task 2: `AgentList` Ink component

**Files:**
- Create: `src/components/AgentList.tsx`

**Step 1: Create the component**

```tsx
// src/components/AgentList.tsx
import React from 'react';
import {Box, Text} from 'ink';
import {AGENT_REGISTRY} from '../agents/index.js';

const COL_ID = 14;

export default function AgentList() {
	return (
		<Box flexDirection="column">
			<Box>
				<Text bold color="gray">
					{'ID'.padEnd(COL_ID)}
				</Text>
				<Text bold color="gray">
					{' Name'}
				</Text>
			</Box>
			<Box>
				<Text color="gray">{'─'.repeat(COL_ID)}</Text>
				<Text color="gray">{' ' + '─'.repeat(10)}</Text>
			</Box>
			{AGENT_REGISTRY.map(agent => (
				<Box key={agent.id}>
					<Text>{agent.id.padEnd(COL_ID)}</Text>
					<Text>{' ' + agent.displayName}</Text>
				</Box>
			))}
		</Box>
	);
}
```

**Step 2: Check prettier**

Run: `npx prettier --check src/components/AgentList.tsx`
If it fails: `npx prettier --write src/components/AgentList.tsx`

**Step 3: Build check**

Run: `bun run build:darwin-arm64 2>&1 | head -5`
Expected: clean build

**Step 4: Commit**

```bash
git add src/components/AgentList.tsx
git commit -m "feat(agent): add AgentList Ink component"
```

---

## Task 3: Wire `agent list` into the CLI

**Files:**
- Modify: `src/cli.tsx`

**Step 1: Read `src/cli.tsx`**

Find the `agentCommand` block (around line 272). The new `list` subcommand goes between the existing `check` subcommand and the `program.hook('preAction', ...)` call.

**Step 2: Add the import**

Near the top of `src/cli.tsx`, alongside other component and command imports, add:

```typescript
import AgentList from './components/AgentList.js';
import {runAgentList} from './commands/agentList.js';
```

**Step 3: Add the `list` subcommand**

Insert this block immediately after the closing `});` of the `agentCommand.command('check')` block and before `program.hook(...)`:

```typescript
agentCommand
	.command('list')
	.description('List all supported AI coding agents')
	.action((_options, command: Command) => {
		const globalOptions = command.parent!.parent!.opts<GlobalOptions>();
		if (isTuiMode(globalOptions)) {
			render(<AgentList />);
			return;
		}

		runAgentList();
	});
```

> **Note on `command.parent!.parent!`:** The `list` command is a child of `agentCommand`, which is a child of `program`. So `command.parent` = `agentCommand`, `command.parent.parent` = `program`. This matches the pattern used by `auth status` at line ~208.

**Step 4: Check prettier**

Run: `npx prettier --check src/cli.tsx`
If it fails: `npx prettier --write src/cli.tsx`

**Step 5: Build check**

Run: `bun run build:darwin-arm64 2>&1 | head -5`
Expected: clean build

**Step 6: Smoke test**

```bash
bun run start agent list          # expect TUI table with both agents
bun run start agent list --no-tui # expect plain-text table
bun run start agent --help        # expect "list" appears in Commands
```

**Step 7: Run all tests**

Run: `bun test ./test-agent-list.ts ./test-agents.ts 2>&1`
Expected: all 12 tests pass (3 new + 9 existing)

**Step 8: Commit**

```bash
git add src/cli.tsx
git commit -m "feat(agent): wire agent list command into CLI"
```

---

## Task 4: Final verification and push

**Step 1: Run full quality gate**

Run: `bun run test 2>&1`
Expected: prettier + xo pass (only the pre-existing `SetupWizard.tsx` warning is acceptable)

**Step 2: Run all agent tests**

Run: `bun test ./test-agents.ts ./test-agent-list.ts 2>&1`
Expected: 12 tests pass

**Step 3: Verify help text**

```bash
bun run start agent --help
bun run start agent list --help
```

**Step 4: Push**

```bash
git pull --rebase
git push
```
