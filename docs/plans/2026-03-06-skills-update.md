# skills update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `aitool skills update` which pulls every installed repo in `~/.agent-skills/` and symlinks any new skills into `~/.claude/skills/`.

**Architecture:** Three-layer pattern identical to `skills install` — command layer returns pure data, TUI component receives it as props, CLI layer wires Commander. The command scans `~/.agent-skills/` for subdirectories, runs `git pull` in each, then symlinks missing `skills/` entries into `~/.claude/skills/`. Per-repo results are collected into an array.

**Tech Stack:** Node built-ins (`fs`, `path`, `child_process.spawnSync`), Ink (TUI), Commander.js, bun:test

---

### Task 1: Command layer — `src/commands/skillsUpdate.ts`

**Files:**
- Create: `src/commands/skillsUpdate.ts`
- Reference: `src/commands/skillsInstall.ts` (copy linking loop pattern)
- Reference: `src/config/paths.ts` (`getAgentSkillsDir`, `getClaudeSkillsDir`)

**Step 1: Write the failing test**

Create `tests/skillsUpdate_spec.ts`:

```typescript
// tests/skillsUpdate_spec.ts
import {describe, expect, test, beforeEach, afterEach} from 'bun:test';
import {mkdtempSync, rmSync, mkdirSync, writeFileSync, lstatSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runSkillsUpdate} from '../src/commands/skillsUpdate.js';

// Override HOME so getAgentSkillsDir / getClaudeSkillsDir point into tmpDir
let tmpDir: string;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'aitool-skills-update-'));
	process.env['HOME'] = tmpDir;
});

afterEach(() => {
	rmSync(tmpDir, {recursive: true, force: true});
});

describe('runSkillsUpdate — no repos installed', () => {
	test('returns empty array when ~/.agent-skills/ does not exist', () => {
		const results = runSkillsUpdate({silent: true});
		expect(results).toEqual([]);
	});

	test('returns empty array when ~/.agent-skills/ exists but is empty', () => {
		mkdirSync(join(tmpDir, '.agent-skills'), {recursive: true});
		const results = runSkillsUpdate({silent: true});
		expect(results).toEqual([]);
	});
});

describe('runSkillsUpdate — no skills/ dir in repo', () => {
	test('reports hasSkillsDir false and no links when skills/ is absent', () => {
		// Simulate a previously-cloned repo with no skills/ subdir
		const repoDir = join(tmpDir, '.agent-skills', 'my-repo');
		mkdirSync(repoDir, {recursive: true});

		// We can't run real git pull in a temp dir, so we test only the
		// post-pull path by stubbing: the command checks for skills/ dir
		// We verify the shape — actual pull tested manually / integration
		const results = runSkillsUpdate({silent: true});
		// pull will fail (not a git repo) → expect error result
		expect(results).toHaveLength(1);
		expect(results[0]!.repoName).toBe('my-repo');
		expect(results[0]!.pulled).toBe(false);
		expect(results[0]!.error).toBeDefined();
	});
});

describe('runSkillsUpdate — linking', () => {
	test('links new skills and skips already-linked ones', () => {
		// Set up: fake installed repo with a skills/ dir
		const repoDir = join(tmpDir, '.agent-skills', 'my-repo');
		const skillsSrc = join(repoDir, 'skills');
		mkdirSync(skillsSrc, {recursive: true});
		writeFileSync(join(skillsSrc, 'skill-a.md'), 'content a');
		writeFileSync(join(skillsSrc, 'skill-b.md'), 'content b');

		// Pre-link skill-a to simulate it already being installed
		const claudeSkillsDir = join(tmpDir, '.claude', 'skills');
		mkdirSync(claudeSkillsDir, {recursive: true});
		const {symlinkSync} = await import('node:fs');
		// Use sync import — already available
		import {symlinkSync as sl} from 'node:fs';
		sl(join(skillsSrc, 'skill-a.md'), join(claudeSkillsDir, 'skill-a.md'));

		// This test runs against a non-git dir so pull fails.
		// We need to test linking in isolation — extract a helper or use integration.
		// For now: verify that a real git repo scenario works via the full path.
		// See integration note below.
	});
});
```

> **Note:** The linking logic can't be fully unit-tested without either (a) mocking `spawnSync` or (b) a real git repo. Bun's test runner doesn't provide module mocking. Write the unit tests that can be written (no-repos path) and rely on the integration test for the pull+link path.

**Step 2: Run test to verify it fails**

```bash
cd /Users/shaw/devops/aitool-cli && bun test tests/skillsUpdate_spec.ts
```

Expected: FAIL — `runSkillsUpdate` doesn't exist yet.

**Step 3: Write the command**

Create `src/commands/skillsUpdate.ts`:

```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getAgentSkillsDir, getClaudeSkillsDir} from '../config/paths.js';
import {type SkillLinkResult} from './skillsInstall.js';

export type SkillsUpdateRepoResult = {
	repoName: string;
	pulled: boolean;
	hasSkillsDir: boolean;
	links: SkillLinkResult[];
	error?: string;
};

function linkMissingSkills(skillsDir: string): SkillLinkResult[] {
	const claudeSkillsDir = getClaudeSkillsDir();
	fs.mkdirSync(claudeSkillsDir, {recursive: true});

	const links: SkillLinkResult[] = [];
	for (const entry of fs.readdirSync(skillsDir)) {
		const target = path.join(claudeSkillsDir, entry);
		const source = path.join(skillsDir, entry);

		// Use lstatSync to detect broken symlinks; existsSync returns false for them
		let targetExists = false;
		try {
			fs.lstatSync(target);
			targetExists = true;
		} catch {}

		if (targetExists) {
			links.push({name: entry, status: 'skipped', reason: 'already exists'});
			continue;
		}

		try {
			fs.symlinkSync(source, target);
			links.push({name: entry, status: 'linked'});
		} catch (error) {
			links.push({
				name: entry,
				status: 'skipped',
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return links;
}

function updateRepo(
	repoName: string,
	cloneDir: string,
	gitStdio: 'pipe' | 'inherit',
): SkillsUpdateRepoResult {
	const pullResult = spawnSync('git', ['pull'], {
		cwd: cloneDir,
		stdio: ['ignore', gitStdio, gitStdio],
	});

	if (pullResult.status !== 0) {
		return {
			repoName,
			pulled: false,
			hasSkillsDir: false,
			links: [],
			error: `Failed to pull ${repoName}`,
		};
	}

	const skillsDir = path.join(cloneDir, 'skills');
	if (!fs.existsSync(skillsDir)) {
		return {repoName, pulled: true, hasSkillsDir: false, links: []};
	}

	const links = linkMissingSkills(skillsDir);
	return {repoName, pulled: true, hasSkillsDir: true, links};
}

export function runSkillsUpdate(options: {
	silent?: boolean;
	json?: boolean;
}): SkillsUpdateRepoResult[] {
	const {silent, json} = options;
	const agentSkillsDir = getAgentSkillsDir();

	if (!fs.existsSync(agentSkillsDir)) {
		return [];
	}

	const repoDirs = fs
		.readdirSync(agentSkillsDir, {withFileTypes: true})
		.filter(d => d.isDirectory())
		.map(d => d.name);

	if (repoDirs.length === 0) {
		return [];
	}

	const gitStdio = (silent ?? json) ? 'pipe' : 'inherit';
	const results: SkillsUpdateRepoResult[] = [];

	for (const repoName of repoDirs) {
		const cloneDir = path.join(agentSkillsDir, repoName);
		const result = updateRepo(repoName, cloneDir, gitStdio);
		results.push(result);

		if (!silent && !json) {
			if (result.error) {
				console.error(`  error: ${repoName} — ${result.error}`);
			} else {
				console.log(`  pulled: ${repoName}`);
				for (const link of result.links) {
					if (link.status === 'linked') {
						console.log(`    linked: ${link.name}`);
					} else {
						console.warn(`    skipped: ${link.name} (${link.reason})`);
					}
				}
			}
		}
	}

	if (json) {
		console.log(JSON.stringify(results, null, 2));
	}

	return results;
}
```

**Step 4: Simplify the test file**

Replace the broken linking test with a clean, achievable test file:

```typescript
// tests/skillsUpdate_spec.ts
import {describe, expect, test, beforeEach, afterEach} from 'bun:test';
import {mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, lstatSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runSkillsUpdate} from '../src/commands/skillsUpdate.js';

let tmpDir: string;
let origHome: string | undefined;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'aitool-skills-update-'));
	origHome = process.env['HOME'];
	process.env['HOME'] = tmpDir;
});

afterEach(() => {
	process.env['HOME'] = origHome;
	rmSync(tmpDir, {recursive: true, force: true});
});

describe('runSkillsUpdate — no repos', () => {
	test('returns [] when ~/.agent-skills/ does not exist', () => {
		expect(runSkillsUpdate({silent: true})).toEqual([]);
	});

	test('returns [] when ~/.agent-skills/ is empty', () => {
		mkdirSync(join(tmpDir, '.agent-skills'));
		expect(runSkillsUpdate({silent: true})).toEqual([]);
	});
});

describe('runSkillsUpdate — pull fails on non-git dir', () => {
	test('returns error result for each non-git repo dir', () => {
		mkdirSync(join(tmpDir, '.agent-skills', 'my-repo'), {recursive: true});
		const results = runSkillsUpdate({silent: true});
		expect(results).toHaveLength(1);
		expect(results[0]!.repoName).toBe('my-repo');
		expect(results[0]!.pulled).toBe(false);
		expect(results[0]!.error).toBe('Failed to pull my-repo');
	});

	test('reports errors for multiple repos and continues', () => {
		mkdirSync(join(tmpDir, '.agent-skills', 'repo-a'), {recursive: true});
		mkdirSync(join(tmpDir, '.agent-skills', 'repo-b'), {recursive: true});
		const results = runSkillsUpdate({silent: true});
		expect(results).toHaveLength(2);
		expect(results.every(r => r.pulled === false)).toBe(true);
	});
});
```

**Step 5: Run tests**

```bash
cd /Users/shaw/devops/aitool-cli && bun test tests/skillsUpdate_spec.ts
```

Expected: PASS (4 tests).

**Step 6: Run full test suite + lint**

```bash
cd /Users/shaw/devops/aitool-cli && bun run test && bun run lint
```

Expected: All tests pass, no lint errors.

**Step 7: Commit**

```bash
git add src/commands/skillsUpdate.ts tests/skillsUpdate_spec.ts
git commit -m "feat: add skills update command layer"
```

---

### Task 2: TUI component — `src/components/SkillsUpdate.tsx`

**Files:**
- Create: `src/components/SkillsUpdate.tsx`
- Reference: `src/components/SkillsInstall.tsx` (same StepRow/LinkRow pattern)

**Step 1: Write the component**

```typescript
// src/components/SkillsUpdate.tsx
import {useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {
	type SkillsUpdateRepoResult,
} from '../commands/skillsUpdate.js';
import {type SkillLinkResult} from '../commands/skillsInstall.js';

type Props = {
	readonly results: SkillsUpdateRepoResult[];
};

function StepRow({
	isOk,
	isWarn,
	label,
}: {
	readonly isOk: boolean;
	readonly isWarn?: boolean;
	readonly label: string;
}) {
	const icon = isWarn ? '⚠' : isOk ? '✓' : '✗';
	const color = isWarn ? 'yellow' : isOk ? 'green' : 'red';
	return (
		<Box gap={1}>
			<Text color={color}>{icon}</Text>
			<Text>{label}</Text>
		</Box>
	);
}

function LinkRow({link}: {readonly link: SkillLinkResult}) {
	const skipped = link.status === 'skipped';
	return (
		<StepRow
			isOk={!skipped}
			isWarn={skipped}
			label={
				skipped
					? `skipped: ${link.name} (${link.reason})`
					: `linked: ${link.name}`
			}
		/>
	);
}

function RepoBlock({result}: {readonly result: SkillsUpdateRepoResult}) {
	return (
		<Box flexDirection="column">
			{result.error ? (
				<StepRow isOk={false} label={`${result.repoName} — ${result.error}`} />
			) : (
				<>
					<StepRow isOk={result.pulled} label={`pulled ${result.repoName}`} />
					{result.pulled ? (
						<StepRow
							isOk={result.hasSkillsDir}
							label={
								result.hasSkillsDir
									? 'found skills/ directory'
									: 'no skills/ directory — nothing linked'
							}
						/>
					) : null}
					{result.links.map(link => (
						<LinkRow key={link.name} link={link} />
					))}
				</>
			)}
		</Box>
	);
}

export default function SkillsUpdate({results}: Props) {
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
			<Text bold>aitool — Skills Update</Text>
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
			>
				{results.length === 0 ? (
					<StepRow
						isOk={false}
						label="no skills repos found in ~/.agent-skills/"
					/>
				) : (
					results.map(r => <RepoBlock key={r.repoName} result={r} />)
				)}
			</Box>
		</Box>
	);
}
```

**Step 2: Run lint on new file**

```bash
cd /Users/shaw/devops/aitool-cli && bunx xo src/components/SkillsUpdate.tsx
```

Expected: no errors. Fix any reported issues (boolean prop naming, leaked render, etc.) before proceeding.

**Step 3: Commit**

```bash
git add src/components/SkillsUpdate.tsx
git commit -m "feat: add SkillsUpdate TUI component"
```

---

### Task 3: CLI wiring — `src/cli.tsx`

**Files:**
- Modify: `src/cli.tsx`

**Step 1: Add imports**

In `src/cli.tsx`, after the existing `SkillsInstall` import line:

```typescript
import {runSkillsUpdate} from './commands/skillsUpdate.js';
import SkillsUpdate from './components/SkillsUpdate.js';
```

**Step 2: Add `skills update` subcommand**

After the `skillsCommand.command('install ...)` block, before `program.hook(...)`:

```typescript
skillsCommand
	.command('update')
	.description(
		'Pull the latest changes for all installed skills repos and link any new skills',
	)
	.option('--json', 'output results as JSON')
	.action(async (options: {json?: boolean}) => {
		const globalOptions = (
			skillsCommand.parent as typeof program
		).opts<GlobalOptions>();
		const tui = !options.json && isTuiMode(globalOptions);

		const results = runSkillsUpdate({
			json: options.json,
			silent: tui,
		});

		if (tui) {
			const {waitUntilExit} = render(<SkillsUpdate results={results} />);
			await waitUntilExit();
		}
	});
```

**Step 3: Run full test suite + lint**

```bash
cd /Users/shaw/devops/aitool-cli && bun run test && bun run lint
```

Expected: All tests pass, no lint errors.

**Step 4: Commit**

```bash
git add src/cli.tsx
git commit -m "feat: wire skills update command in CLI"
```

---

### Task 4: Final verification

**Step 1: Build check**

```bash
cd /Users/shaw/devops/aitool-cli && bun run build:all 2>&1 | head -40
```

Expected: no TypeScript errors.

**Step 2: Smoke test**

```bash
node dist/aitool.js skills --help
node dist/aitool.js skills update --help
```

Expected: `update` subcommand appears with correct description.

**Step 3: Manual run**

```bash
node dist/aitool.js skills update
```

Expected: TUI renders "no skills repos found in ~/.agent-skills/" if nothing installed, or pulls + links if repos exist.
