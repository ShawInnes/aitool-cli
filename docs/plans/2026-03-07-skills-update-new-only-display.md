# Skills Update New-Only Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Filter `skills update` output so only newly-linked skills are shown, suppressing `skipped: already exists` noise.

**Architecture:** Display-layer-only filter. `linkSkillEntries` and `SkillsUpdateRepoResult` are unchanged. Both the plain-text path (`printResult` in `skillsUpdate.ts`) and the TUI path (`RepoBlock` in `SkillsUpdate.tsx`) filter to `status === 'linked'` entries and omit sections entirely when no new links exist.

**Tech Stack:** TypeScript, Ink (TUI), Bun test runner, xo linter

---

### Task 1: Filter plain-text output in `skillsUpdate.ts`

**Files:**
- Modify: `src/commands/skillsUpdate.ts`

**Step 1: Open and read the file**

Check `src/commands/skillsUpdate.ts`, specifically `printResult` (lines 20–42) and the inner `printLinks` helper.

**Step 2: Update `printLinks` to filter new-only and skip empty sections**

In `printResult`, change `printLinks` so it:
- Filters `entries` to only those with `status === 'linked'`
- Returns early (no output) if the filtered list is empty

Replace the `printLinks` inner function:

```ts
const printLinks = (label: string, entries: SkillLinkResult[]) => {
	const newLinks = entries.filter(l => l.status === 'linked');
	if (newLinks.length === 0) return;
	console.log(`  ${label}`);
	for (const link of newLinks) {
		console.log(`    linked: ${link.name}`);
	}
};
```

**Step 3: Run tests and lint**

```bash
bun run test
bun run lint
```

Expected: all pass (no test covers this output directly — lint must pass).

---

### Task 2: Filter TUI output in `SkillsUpdate.tsx`

**Files:**
- Modify: `src/components/SkillsUpdate.tsx`

**Step 1: Open and read the file**

Check `src/components/SkillsUpdate.tsx`, specifically `RepoBlock` (lines 61–79) and the `LinkGroup` usage.

**Step 2: Filter links in `RepoBlock` to new-only, suppress sections when empty**

In `RepoBlock`, derive filtered arrays before rendering and only render `LinkGroup` when the filtered array is non-empty:

```tsx
function RepoBlock({result}: {readonly result: SkillsUpdateRepoResult}) {
	const newLinks = result.links.filter(l => l.status === 'linked');
	const newAgentLinks = result.agentLinks.filter(l => l.status === 'linked');

	return (
		<Box flexDirection="column">
			{result.error ? (
				<StepRow isOk={false} label={`${result.repoName} — ${result.error}`} />
			) : (
				<>
					<StepRow isOk={result.pulled} label={`pulled ${result.repoName}`} />
					{result.pulled && newLinks.length > 0 ? (
						<LinkGroup label="~/.claude/skills/" links={newLinks} />
					) : null}
					{result.pulled && newAgentLinks.length > 0 ? (
						<LinkGroup label="~/.agents/skills/" links={newAgentLinks} />
					) : null}
				</>
			)}
		</Box>
	);
}
```

Note: `LinkGroup` now only receives `status === 'linked'` entries, so `LinkRow` will always render the green `linked:` path. The `isWarn` / skipped branch in `LinkRow` is preserved for install command reuse — do not remove it.

**Step 3: Run tests and lint**

```bash
bun run test
bun run lint
```

Expected: all pass.

---

### Task 3: Commit

```bash
git add src/commands/skillsUpdate.ts src/components/SkillsUpdate.tsx
git commit -m "feat: show only newly linked skills in skills update output"
```
