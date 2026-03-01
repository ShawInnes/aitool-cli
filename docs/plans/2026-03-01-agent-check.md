# Agent Check Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an `aitool agent check [agent-id]` command that detects whether supported AI coding agents (Claude Code, Open Code) are installed on the system.

**Architecture:** Approach B — interface + result types live in `src/agents/agent.ts`, each agent has its own file in `src/agents/`, a registry in `src/agents/index.ts` exports all checkers, and `src/commands/agentCheck.ts` holds the `runAgentCheck()` business logic. CLI wiring is added to `src/cli.tsx`.

**Tech Stack:** TypeScript, Commander.js, Node.js `child_process.execSync`, Ava (tests), xo (linting), bun (runtime)

---

## Task 1: Define the `AgentChecker` interface and result type

**Files:**
- Create: `src/agents/agent.ts`

**Step 1: Create the file**

```typescript
// src/agents/agent.ts

/**
 * Result of checking whether an AI coding agent is installed.
 */
export type AgentCheckResult = {
	installed: boolean;
	version?: string;
	path?: string;
	error?: string;
};

/**
 * Interface for an AI coding agent installation checker.
 *
 * Each implementing class knows how to detect a specific agent binary
 * and extract its version string. The `check()` method must never throw —
 * it should return `installed: false` with an optional error message
 * when detection fails for any reason.
 */
export interface AgentChecker {
	/** Machine-readable identifier used as the CLI argument (e.g. "claude-code") */
	readonly id: string;
	/** Human-readable display name (e.g. "Claude Code") */
	readonly displayName: string;

	/**
	 * Checks whether this agent is installed on the current system.
	 *
	 * Returns a resolved promise — never rejects.
	 */
	check(): Promise<AgentCheckResult>;
}
```

**Step 2: Build to verify TypeScript compiles**

Run: `bun run build:darwin-arm64 2>&1 | head -20`
Expected: build succeeds (or only pre-existing errors, none from `src/agents/agent.ts`)

**Step 3: Commit**

```bash
git add src/agents/agent.ts
git commit -m "feat(agent): add AgentChecker interface and result type"
```

---

## Task 2: Implement `ClaudeCodeChecker`

**Files:**
- Create: `src/agents/claudeCode.ts`

**Step 1: Create the file**

```typescript
// src/agents/claudeCode.ts
import {execSync} from 'node:child_process';
import {type AgentCheckResult, type AgentChecker} from './agent.js';

/**
 * Checks whether Claude Code (Anthropic's AI coding CLI) is installed.
 *
 * Detection strategy:
 *  1. Run `claude --version` and capture stdout.
 *     - If successful, parse the version string from the first line of output.
 *  2. If `claude --version` fails (binary absent or permission error),
 *     fall back to `which claude` (or `where claude` on Windows) to
 *     locate the binary path without invoking it.
 *  3. If both commands fail, the agent is considered not installed.
 *
 * References:
 *  - Install: npm install -g @anthropic-ai/claude-code
 *             OR curl -fsSL https://claude.ai/install.sh | bash
 *  - Binary name: `claude`
 *  - Typical paths: ~/.local/bin/claude, ~/.claude/bin/claude
 */
export class ClaudeCodeChecker implements AgentChecker {
	readonly id = 'claude-code';
	readonly displayName = 'Claude Code';

	async check(): Promise<AgentCheckResult> {
		// Attempt 1: run `claude --version`
		try {
			const output = execSync('claude --version', {
				stdio: 'pipe',
				encoding: 'utf8',
			}).trim();
			const version = output.split('\n')[0]?.trim();
			return {installed: true, version};
		} catch {
			// Binary not found or returned non-zero — fall through
		}

		// Attempt 2: locate binary with which/where
		const whichCmd =
			process.platform === 'win32' ? 'where claude' : 'which claude';
		try {
			const path = execSync(whichCmd, {
				stdio: 'pipe',
				encoding: 'utf8',
			}).trim();
			return {installed: true, path};
		} catch {
			return {installed: false, error: 'binary "claude" not found in PATH'};
		}
	}
}
```

**Step 2: Build to verify no compile errors**

Run: `bun run build:darwin-arm64 2>&1 | head -20`
Expected: clean build

**Step 3: Commit**

```bash
git add src/agents/claudeCode.ts
git commit -m "feat(agent): add ClaudeCodeChecker implementation"
```

---

## Task 3: Implement `OpenCodeChecker`

**Files:**
- Create: `src/agents/openCode.ts`

**Step 1: Create the file**

```typescript
// src/agents/openCode.ts
import {execSync} from 'node:child_process';
import {type AgentCheckResult, type AgentChecker} from './agent.js';

/**
 * Checks whether Open Code (opencode-ai terminal coding agent) is installed.
 *
 * Detection strategy:
 *  1. Run `opencode --version` and capture stdout.
 *     - If successful, parse the version string from the first line of output.
 *  2. If `opencode --version` fails, fall back to `which opencode`
 *     (or `where opencode` on Windows).
 *  3. If both commands fail, the agent is considered not installed.
 *
 * References:
 *  - Install: curl -fsSL https://opencode.ai/install | bash
 *             OR npm i -g opencode-ai@latest
 *             OR brew install opencode
 *  - Binary name: `opencode`
 *  - Repository: https://github.com/opencode-ai/opencode
 */
export class OpenCodeChecker implements AgentChecker {
	readonly id = 'opencode';
	readonly displayName = 'Open Code';

	async check(): Promise<AgentCheckResult> {
		// Attempt 1: run `opencode --version`
		try {
			const output = execSync('opencode --version', {
				stdio: 'pipe',
				encoding: 'utf8',
			}).trim();
			const version = output.split('\n')[0]?.trim();
			return {installed: true, version};
		} catch {
			// Binary not found or returned non-zero — fall through
		}

		// Attempt 2: locate binary with which/where
		const whichCmd =
			process.platform === 'win32' ? 'where opencode' : 'which opencode';
		try {
			const path = execSync(whichCmd, {
				stdio: 'pipe',
				encoding: 'utf8',
			}).trim();
			return {installed: true, path};
		} catch {
			return {installed: false, error: 'binary "opencode" not found in PATH'};
		}
	}
}
```

**Step 2: Build to verify**

Run: `bun run build:darwin-arm64 2>&1 | head -20`
Expected: clean build

**Step 3: Commit**

```bash
git add src/agents/openCode.ts
git commit -m "feat(agent): add OpenCodeChecker implementation"
```

---

## Task 4: Create the agent registry

**Files:**
- Create: `src/agents/index.ts`

**Step 1: Create the file**

```typescript
// src/agents/index.ts
export {type AgentCheckResult, type AgentChecker} from './agent.js';
export {ClaudeCodeChecker} from './claudeCode.js';
export {OpenCodeChecker} from './openCode.js';

import {ClaudeCodeChecker} from './claudeCode.js';
import {OpenCodeChecker} from './openCode.js';
import {type AgentChecker} from './agent.js';

/**
 * All registered agent checkers. Add new checkers here to include them
 * in `aitool agent check` (no-arg) output.
 */
export const AGENT_REGISTRY: AgentChecker[] = [
	new ClaudeCodeChecker(),
	new OpenCodeChecker(),
];
```

**Step 2: Build to verify**

Run: `bun run build:darwin-arm64 2>&1 | head -20`
Expected: clean build

**Step 3: Commit**

```bash
git add src/agents/index.ts
git commit -m "feat(agent): add agent registry"
```

---

## Task 5: Write tests for the checkers

**Files:**
- Create: `test-agents.ts`

**Step 1: Write the failing tests**

```typescript
// test-agents.ts
import test from 'ava';
import {execSync} from 'node:child_process';
import {ClaudeCodeChecker} from './src/agents/claudeCode.js';
import {OpenCodeChecker} from './src/agents/openCode.js';
import {AGENT_REGISTRY} from './src/agents/index.js';

// ─── ClaudeCodeChecker ──────────────────────────────────────────────────────

test('ClaudeCodeChecker has correct id and displayName', t => {
	const checker = new ClaudeCodeChecker();
	t.is(checker.id, 'claude-code');
	t.is(checker.displayName, 'Claude Code');
});

test('ClaudeCodeChecker.check() returns installed:true when claude is present', async t => {
	// Stub execSync so it simulates `claude --version` returning a version
	const checker = new ClaudeCodeChecker();
	// Monkey-patch the module-level import by overriding via the instance
	// (simplest approach without a full mocking library)
	const original = (checker as any)._execSync;
	(checker as any)._execSync = (cmd: string) => {
		if (cmd === 'claude --version') return 'claude 1.2.3\n';
		throw new Error('not found');
	};

	const result = await checker.check();
	t.true(result.installed);
	t.is(result.version, 'claude 1.2.3');

	(checker as any)._execSync = original;
});

test('ClaudeCodeChecker.check() returns installed:false when claude is absent', async t => {
	const checker = new ClaudeCodeChecker();
	(checker as any)._execSync = () => {
		throw new Error('not found');
	};

	const result = await checker.check();
	t.false(result.installed);
	t.truthy(result.error);
});

// ─── OpenCodeChecker ────────────────────────────────────────────────────────

test('OpenCodeChecker has correct id and displayName', t => {
	const checker = new OpenCodeChecker();
	t.is(checker.id, 'opencode');
	t.is(checker.displayName, 'Open Code');
});

test('OpenCodeChecker.check() returns installed:true when opencode is present', async t => {
	const checker = new OpenCodeChecker();
	(checker as any)._execSync = (cmd: string) => {
		if (cmd === 'opencode --version') return 'opencode 0.5.0\n';
		throw new Error('not found');
	};

	const result = await checker.check();
	t.true(result.installed);
	t.is(result.version, 'opencode 0.5.0');
});

test('OpenCodeChecker.check() returns installed:false when opencode is absent', async t => {
	const checker = new OpenCodeChecker();
	(checker as any)._execSync = () => {
		throw new Error('not found');
	};

	const result = await checker.check();
	t.false(result.installed);
	t.truthy(result.error);
});

// ─── Registry ───────────────────────────────────────────────────────────────

test('AGENT_REGISTRY contains claude-code and opencode', t => {
	const ids = AGENT_REGISTRY.map(a => a.id);
	t.true(ids.includes('claude-code'));
	t.true(ids.includes('opencode'));
});
```

**Step 2: Run tests to verify they fail (or compile-fail on the monkey-patch approach)**

Run: `bun test test-agents.ts 2>&1 | head -30`
Expected: compile or test failures — that's correct at this stage.

> **Note:** The monkey-patch approach won't work cleanly because `execSync` is module-level.
> In the next task we'll refactor the checkers to accept an injectable `execSync` dependency so tests can stub it cleanly.

**Step 3: Refactor checkers to accept injectable `execSync`**

Update `src/agents/claudeCode.ts` to accept an injected executor:

```typescript
// src/agents/claudeCode.ts
import {execSync as nodeExecSync} from 'node:child_process';
import {type AgentCheckResult, type AgentChecker} from './agent.js';

type Executor = (cmd: string, opts: {stdio: string; encoding: string}) => string;

export class ClaudeCodeChecker implements AgentChecker {
	readonly id = 'claude-code';
	readonly displayName = 'Claude Code';

	private readonly exec: Executor;

	constructor(exec: Executor = nodeExecSync as unknown as Executor) {
		this.exec = exec;
	}

	// ... same check() body but use this.exec(...) instead of execSync(...)
}
```

Apply the same pattern to `src/agents/openCode.ts`.

**Step 4: Update tests to use the constructor injection**

```typescript
test('ClaudeCodeChecker.check() returns installed:true when claude is present', async t => {
	const checker = new ClaudeCodeChecker((cmd) => {
		if (cmd === 'claude --version') return 'claude 1.2.3\n';
		throw new Error('not found');
	});
	const result = await checker.check();
	t.true(result.installed);
	t.is(result.version, 'claude 1.2.3');
});
```

**Step 5: Run tests — expect pass**

Run: `bun test test-agents.ts 2>&1`
Expected: all tests pass

**Step 6: Commit**

```bash
git add test-agents.ts src/agents/claudeCode.ts src/agents/openCode.ts
git commit -m "test(agent): add checker unit tests with injectable executor"
```

---

## Task 6: Implement `runAgentCheck()` command function

**Files:**
- Create: `src/commands/agentCheck.ts`

**Step 1: Create the file**

```typescript
// src/commands/agentCheck.ts
import {AGENT_REGISTRY, type AgentChecker} from '../agents/index.js';

export type AgentCheckOptions = {
	/** If provided, only check the agent with this id. Check all if omitted. */
	agent?: string;
	/** Emit results as JSON instead of human-readable text. */
	json?: boolean;
};

export type AgentCheckSummary = {
	id: string;
	displayName: string;
	installed: boolean;
	version?: string;
	path?: string;
	error?: string;
};

/**
 * Runs install checks for one or all registered agents and prints the results.
 *
 * @param options.agent - optional agent id to check (e.g. "claude-code").
 *                        When omitted, all agents in AGENT_REGISTRY are checked.
 * @param options.json  - when true, print a JSON array instead of plain text.
 */
export async function runAgentCheck(
	options: AgentCheckOptions = {},
): Promise<void> {
	const {agent: agentId, json = false} = options;

	// Resolve which checkers to run
	let checkers: AgentChecker[];
	if (agentId) {
		const found = AGENT_REGISTRY.find(c => c.id === agentId);
		if (!found) {
			const valid = AGENT_REGISTRY.map(c => c.id).join(', ');
			console.error(
				`Unknown agent "${agentId}". Valid options: ${valid}`,
			);
			process.exit(1);
		}
		checkers = [found];
	} else {
		checkers = AGENT_REGISTRY;
	}

	// Run all checks in parallel
	const results: AgentCheckSummary[] = await Promise.all(
		checkers.map(async c => {
			const result = await c.check();
			return {id: c.id, displayName: c.displayName, ...result};
		}),
	);

	if (json) {
		console.log(JSON.stringify(results, null, 2));
		return;
	}

	// Human-readable output
	for (const r of results) {
		const status = r.installed ? '✓ installed' : '✗ not installed';
		const detail = r.version
			? ` (${r.version})`
			: r.path
				? ` (${r.path})`
				: r.error
					? ` — ${r.error}`
					: '';
		console.log(`${r.displayName.padEnd(14)} ${status}${detail}`);
	}
}
```

**Step 2: Build to verify**

Run: `bun run build:darwin-arm64 2>&1 | head -20`
Expected: clean build

**Step 3: Commit**

```bash
git add src/commands/agentCheck.ts
git commit -m "feat(agent): add runAgentCheck command function"
```

---

## Task 7: Wire `agent check` into the CLI

**Files:**
- Modify: `src/cli.tsx`

**Step 1: Add import**

Near the top of `src/cli.tsx`, alongside other command imports:

```typescript
import {runAgentCheck} from './commands/agentCheck.js';
```

**Step 2: Add the `agent` command block**

After the last `.command(...)` block and before `program.parseAsync(process.argv)`, add:

```typescript
const agentCommand = program
	.command('agent')
	.description('Manage and inspect AI coding agents');

agentCommand
	.command('check [agent-id]')
	.description(
		'Check whether AI coding agents are installed. ' +
			'Pass an agent id (claude-code, opencode) to check a specific one, ' +
			'or omit to check all.',
	)
	.option('--json', 'output results as JSON')
	.action(async (agentId: string | undefined, options: {json?: boolean}) => {
		await runAgentCheck({agent: agentId, json: options.json});
	});
```

**Step 3: Build to verify**

Run: `bun run build:darwin-arm64 2>&1 | head -20`
Expected: clean build

**Step 4: Smoke-test manually**

```bash
bun run start agent check
bun run start agent check claude-code
bun run start agent check --json
bun run start agent check badname   # expect error + exit 1
```

**Step 5: Run full test suite**

Run: `bun test 2>&1`
Expected: all existing tests still pass

**Step 6: Run linter**

Run: `bun run test 2>&1`
Expected: prettier + xo pass

**Step 7: Commit**

```bash
git add src/cli.tsx
git commit -m "feat(agent): wire agent check command into CLI"
```

---

## Task 8: Final integration verification and push

**Step 1: Run full quality gate**

Run: `bun run test && bun test test-agents.ts`
Expected: all pass

**Step 2: Verify CLI help text**

Run: `bun run start agent --help` and `bun run start agent check --help`
Expected: both show correct descriptions

**Step 3: Push**

```bash
git pull --rebase
git push
```
