# Multi-Agent Skills Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Link installed skills to both `~/.claude/skills/` (Claude Code) and `~/.agents/skills/` (OpenCode + Crush) using the Agent Skills open standard directory format.

**Architecture:** Add a new path helper `getAgentsSkillsDir()`, extract a shared `linkSkills()` helper in both skills commands, and call it for each destination. Result types gain an `agentLinks` field alongside the existing `links` field. TUI components render both. The project's own `.claude/skills/` flat `.md` files are migrated to the directory format (`skill-name/SKILL.md`).

**Tech Stack:** TypeScript, Bun, Ink (TUI), Node `fs` module, bun:test

---

### Task 1: Add `getAgentsSkillsDir()` to `src/config/paths.ts`

**Files:**
- Modify: `src/config/paths.ts`

**Step 1: Add the new path helper**

In `src/config/paths.ts`, after `getClaudeSkillsDir()`, add:

```ts
export function getAgentsSkillsDir(): string {
  return path.join(homeDir(), '.agents', 'skills');
}
```

**Step 2: Verify it compiles**

```bash
cd /Users/shaw/devops/aitool-cli/.claude/worktrees/objective-mirzakhani
bun run lint
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/config/paths.ts
git commit -m "feat: add getAgentsSkillsDir path helper"
```

---

### Task 2: Update `SkillsInstallResult` type and link logic

**Files:**
- Modify: `src/commands/skillsInstall.ts`

**Step 1: Write failing test in `tests/skillsInstall_spec.ts`**

Create `tests/skillsInstall_spec.ts`:

```ts
import {describe, expect, test, beforeEach, afterEach} from 'bun:test';
import {mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, lstatSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {runSkillsInstall} from '../src/commands/skillsInstall.js';

let tmpDir: string;
let origHome: string | undefined;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'aitool-skills-install-'));
  origHome = process.env['HOME'];
  process.env['HOME'] = tmpDir;
});

afterEach(() => {
  process.env['HOME'] = origHome;
  rmSync(tmpDir, {recursive: true, force: true});
});

function setupBareRepo(tmpDir: string): string {
  const bareRepo = join(tmpDir, 'bare-repo.git');
  mkdirSync(bareRepo);
  spawnSync('git', ['init', '--bare', bareRepo]);

  const workDir = join(tmpDir, 'work-repo');
  spawnSync('git', ['clone', bareRepo, workDir]);
  spawnSync('git', ['config', 'user.email', 'test@test.com'], {cwd: workDir});
  spawnSync('git', ['config', 'user.name', 'Test'], {cwd: workDir});

  const skillsDir = join(workDir, 'skills');
  mkdirSync(skillsDir);
  // Agent Skills directory format: skills/my-skill/SKILL.md
  mkdirSync(join(skillsDir, 'my-skill'));
  writeFileSync(join(skillsDir, 'my-skill', 'SKILL.md'), '---\nname: my-skill\n---\nhello');

  spawnSync('git', ['add', '.'], {cwd: workDir});
  spawnSync('git', ['commit', '-m', 'init'], {cwd: workDir});
  spawnSync('git', ['push', 'origin', 'HEAD'], {cwd: workDir});

  return bareRepo;
}

describe('runSkillsInstall — error cases', () => {
  test('returns error for empty repo URL', () => {
    const result = runSkillsInstall({repoUrl: '', silent: true});
    expect(result.error).toBeTruthy();
  });
});

describe('runSkillsInstall — success path', () => {
  test('links skill dir to ~/.claude/skills/ and ~/.agents/skills/', () => {
    const bareRepo = setupBareRepo(tmpDir);
    const result = runSkillsInstall({repoUrl: bareRepo, silent: true});

    expect(result.cloned).toBe(true);
    expect(result.hasSkillsDir).toBe(true);

    // Claude Code links
    expect(result.links).toHaveLength(1);
    expect(result.links[0]).toMatchObject({name: 'my-skill', status: 'linked'});
    expect(lstatSync(join(tmpDir, '.claude', 'skills', 'my-skill')).isSymbolicLink()).toBe(true);

    // Agent Skills standard links
    expect(result.agentLinks).toHaveLength(1);
    expect(result.agentLinks[0]).toMatchObject({name: 'my-skill', status: 'linked'});
    expect(lstatSync(join(tmpDir, '.agents', 'skills', 'my-skill')).isSymbolicLink()).toBe(true);
  });

  test('skips already-linked skills for both targets', () => {
    const bareRepo = setupBareRepo(tmpDir);
    // Pre-create the agent link so it already exists
    mkdirSync(join(tmpDir, '.agents', 'skills'), {recursive: true});
    const cloneDir = join(tmpDir, '.agent-skills', 'bare-repo');
    spawnSync('git', ['clone', bareRepo, cloneDir]);
    const {symlinkSync} = await import('node:fs');
    // Actually just run install twice
    runSkillsInstall({repoUrl: bareRepo, silent: true});
    // Clone dir now exists — second call should return an error about already installed
    const result2 = runSkillsInstall({repoUrl: bareRepo, silent: true});
    expect(result2.error).toContain('already installed');
  });
});
```

> Note: The "skip" test above is intentionally simple — the "already installed" check fires before linking. The real skip-already-linked behavior is covered by the update tests.

**Step 2: Run test to verify it fails**

```bash
bun test tests/skillsInstall_spec.ts
```
Expected: FAIL — `result.agentLinks` is `undefined`.

**Step 3: Update `src/commands/skillsInstall.ts`**

a) Add `agentLinks` to `SkillsInstallResult`:

```ts
export type SkillsInstallResult = {
  repoUrl: string;
  repoName: string;
  cloneDir: string;
  cloned: boolean;
  hasSkillsDir: boolean;
  links: SkillLinkResult[];       // ~/.claude/skills/
  agentLinks: SkillLinkResult[];  // ~/.agents/skills/
  error?: string;
};
```

b) Import `getAgentsSkillsDir` alongside `getClaudeSkillsDir`:

```ts
import {getAgentSkillsDir, getClaudeSkillsDir, getAgentsSkillsDir} from '../config/paths.js';
```

c) Extract a shared helper (replaces the inline loop):

```ts
function linkSkillEntries(skillsDir: string, targetDir: string): SkillLinkResult[] {
  fs.mkdirSync(targetDir, {recursive: true});
  const links: SkillLinkResult[] = [];

  for (const entry of fs.readdirSync(skillsDir)) {
    const target = path.join(targetDir, entry);
    const source = path.join(skillsDir, entry);

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
```

d) Update `runSkillsInstall` to call the helper for both targets. Replace the existing `const claudeSkillsDir = getClaudeSkillsDir()` block through the end of the function with:

```ts
  const links = linkSkillEntries(skillsDir, getClaudeSkillsDir());
  const agentLinks = linkSkillEntries(skillsDir, getAgentsSkillsDir());

  const result: SkillsInstallResult = {
    ...base,
    cloned: true,
    hasSkillsDir: true,
    links,
    agentLinks,
  };

  emit(options, result, () => {
    console.log('~/.claude/skills/');
    for (const link of links) {
      if (link.status === 'linked') {
        console.log(`  linked: ${link.name}`);
      } else {
        console.warn(`  skipped: ${link.name} (${link.reason})`);
      }
    }
    console.log('~/.agents/skills/');
    for (const link of agentLinks) {
      if (link.status === 'linked') {
        console.log(`  linked: ${link.name}`);
      } else {
        console.warn(`  skipped: ${link.name} (${link.reason})`);
      }
    }
  });

  return result;
```

e) Also update the early-exit result objects (the `!repoName`, `existsSync(cloneDir)`, clone-failed, and no-skills-dir cases) to include `agentLinks: []`.

**Step 4: Run test to verify it passes**

```bash
bun test tests/skillsInstall_spec.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/skillsInstall.ts tests/skillsInstall_spec.ts
git commit -m "feat: link skills to both ~/.claude/skills and ~/.agents/skills on install"
```

---

### Task 3: Update `skillsUpdate.ts` and its tests

**Files:**
- Modify: `src/commands/skillsUpdate.ts`
- Modify: `tests/skillsUpdate_spec.ts`

**Step 1: Write the failing tests**

Add these test cases to `tests/skillsUpdate_spec.ts` (inside the `'runSkillsUpdate — success path'` describe block):

```ts
test('links new skills to ~/.agents/skills/ as well', () => {
  setupGitRepo(tmpDir);
  const results = runSkillsUpdate({silent: true});
  expect(results[0]!.agentLinks).toHaveLength(1);
  expect(results[0]!.agentLinks[0]).toMatchObject({name: 'my-skill', status: 'linked'});
  const agentLink = join(tmpDir, '.agents', 'skills', 'my-skill');
  expect(lstatSync(agentLink).isSymbolicLink()).toBe(true);
});

test('skips already-linked skills in ~/.agents/skills/', () => {
  const cloneDir = setupGitRepo(tmpDir);
  const agentsSkillsDir = join(tmpDir, '.agents', 'skills');
  mkdirSync(agentsSkillsDir, {recursive: true});
  symlinkSync(
    join(cloneDir, 'skills', 'my-skill'),
    join(agentsSkillsDir, 'my-skill'),
  );
  const results = runSkillsUpdate({silent: true});
  expect(results[0]!.agentLinks[0]).toMatchObject({name: 'my-skill', status: 'skipped'});
});
```

Also update the existing `setupGitRepo` fixture to use the directory format:

```ts
// Change this line in setupGitRepo:
writeFileSync(join(skillsDir, 'my-skill.md'), 'hello');
// To:
mkdirSync(join(skillsDir, 'my-skill'));
writeFileSync(join(skillsDir, 'my-skill', 'SKILL.md'), '---\nname: my-skill\n---\nhello');
```

Update existing assertion names (`'my-skill.md'` → `'my-skill'`) throughout the file.

Also add `lstatSync` to the imports at the top of the test file:

```ts
import {mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, lstatSync} from 'node:fs';
```

**Step 2: Run tests to verify they fail**

```bash
bun test tests/skillsUpdate_spec.ts
```
Expected: FAIL on the new `agentLinks` tests.

**Step 3: Update `src/commands/skillsUpdate.ts`**

a) Add `agentLinks` to `SkillsUpdateRepoResult`:

```ts
export type SkillsUpdateRepoResult = {
  repoName: string;
  pulled: boolean;
  hasSkillsDir: boolean;
  links: SkillLinkResult[];       // ~/.claude/skills/
  agentLinks: SkillLinkResult[];  // ~/.agents/skills/
  error?: string;
};
```

b) Import `getAgentsSkillsDir` and the extracted helper. Since `linkSkillEntries` lives in `skillsInstall.ts`, export it from there and import it here:

In `src/commands/skillsInstall.ts`, export the helper:
```ts
export function linkSkillEntries(skillsDir: string, targetDir: string): SkillLinkResult[] {
```

In `src/commands/skillsUpdate.ts`:
```ts
import {type SkillLinkResult, linkSkillEntries} from './skillsInstall.js';
import {getAgentSkillsDir, getClaudeSkillsDir, getAgentsSkillsDir} from '../config/paths.js';
```

c) Replace `linkMissingSkills` with calls to the shared helper:

```ts
// Remove the old linkMissingSkills function entirely.
// In updateRepo, replace:
//   const links = linkMissingSkills(skillsDir);
// with:
  const links = linkSkillEntries(skillsDir, getClaudeSkillsDir());
  const agentLinks = linkSkillEntries(skillsDir, getAgentsSkillsDir());
  return {repoName, pulled: true, hasSkillsDir: true, links, agentLinks};
```

d) Update the early-exit `return` in `updateRepo` (the `!skillsDirExists` branch) to include `agentLinks: []`:

```ts
return {repoName, pulled: true, hasSkillsDir: false, links: [], agentLinks: []};
```

e) Update the error return at the top of `updateRepo` to include `agentLinks: []`:

```ts
return {
  repoName,
  pulled: false,
  hasSkillsDir: false,
  links: [],
  agentLinks: [],
  error: `Failed to pull ${repoName}: ${reason}`,
};
```

f) Update `printResult` to show both sets of links:

```ts
function printResult(result: SkillsUpdateRepoResult): void {
  if (result.error) {
    console.error(`  error: ${result.repoName} — ${result.error}`);
    return;
  }
  console.log(`  pulled: ${result.repoName}`);
  if (result.links.length > 0 || result.agentLinks.length > 0) {
    console.log('  ~/.claude/skills/');
    for (const link of result.links) {
      link.status === 'linked'
        ? console.log(`    linked: ${link.name}`)
        : console.warn(`    skipped: ${link.name} (${link.reason})`);
    }
    console.log('  ~/.agents/skills/');
    for (const link of result.agentLinks) {
      link.status === 'linked'
        ? console.log(`    linked: ${link.name}`)
        : console.warn(`    skipped: ${link.name} (${link.reason})`);
    }
  }
}
```

**Step 4: Run all tests**

```bash
bun test
```
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/commands/skillsInstall.ts src/commands/skillsUpdate.ts tests/skillsUpdate_spec.ts tests/skillsInstall_spec.ts
git commit -m "feat: link skills to ~/.agents/skills on update; share linkSkillEntries helper"
```

---

### Task 4: Update TUI components

**Files:**
- Modify: `src/components/SkillsInstall.tsx`
- Modify: `src/components/SkillsUpdate.tsx`

No new tests needed — TUI components are not unit-tested in this project.

**Step 1: Update `SkillsInstall.tsx`**

Replace the `{result.links.map(...)}` section with a grouped layout:

```tsx
{result.hasSkillsDir ? (
  <>
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">~/.claude/skills/</Text>
      {result.links.length === 0 ? (
        <Text color="gray">  (none)</Text>
      ) : (
        result.links.map(link => (
          <LinkRow key={`claude-${link.name}`} link={link} />
        ))
      )}
    </Box>
    <Box flexDirection="column" marginTop={1}>
      <Text color="gray">~/.agents/skills/</Text>
      {result.agentLinks.length === 0 ? (
        <Text color="gray">  (none)</Text>
      ) : (
        result.agentLinks.map(link => (
          <LinkRow key={`agents-${link.name}`} link={link} />
        ))
      )}
    </Box>
  </>
) : null}
```

**Step 2: Update `SkillsUpdate.tsx`**

Inside `RepoBlock`, replace the `{result.links.map(...)}` section with the same grouped layout pattern used in `SkillsInstall.tsx`, but scoped to `result.links` and `result.agentLinks`.

```tsx
{result.pulled && result.hasSkillsDir ? (
  <>
    <Box flexDirection="column">
      <Text color="gray">  ~/.claude/skills/</Text>
      {result.links.map(link => (
        <LinkRow key={`claude-${link.name}`} link={link} />
      ))}
    </Box>
    <Box flexDirection="column">
      <Text color="gray">  ~/.agents/skills/</Text>
      {result.agentLinks.map(link => (
        <LinkRow key={`agents-${link.name}`} link={link} />
      ))}
    </Box>
  </>
) : null}
```

**Step 3: Run lint to confirm no type errors**

```bash
bun run lint
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/SkillsInstall.tsx src/components/SkillsUpdate.tsx
git commit -m "feat: show agent skills links in skills install/update TUI"
```

---

### Task 5: Migrate `.claude/skills/` flat files to directory format

**Files:**
- Delete: `.claude/skills/add-agent-definition.md`
- Delete: `.claude/skills/add-cli-command.md`
- Delete: `.claude/skills/commit.md`
- Delete: `.claude/skills/testing.md`
- Create: `.claude/skills/add-agent-definition/SKILL.md`
- Create: `.claude/skills/add-cli-command/SKILL.md`
- Create: `.claude/skills/commit/SKILL.md`
- Create: `.claude/skills/testing/SKILL.md`

**Step 1: Create the new directory structure**

For each skill, create a directory and move the content into `SKILL.md` inside it. The frontmatter and body stay identical. Run these shell commands:

```bash
cd /Users/shaw/devops/aitool-cli/.claude/worktrees/objective-mirzakhani

for skill in add-agent-definition add-cli-command commit testing; do
  mkdir -p .claude/skills/$skill
  cp .claude/skills/$skill.md .claude/skills/$skill/SKILL.md
  rm .claude/skills/$skill.md
done
```

**Step 2: Verify the structure**

```bash
find .claude/skills -type f | sort
```
Expected output:
```
.claude/skills/add-agent-definition/SKILL.md
.claude/skills/add-cli-command/SKILL.md
.claude/skills/commit/SKILL.md
.claude/skills/testing/SKILL.md
```

**Step 3: Run tests to confirm nothing broke**

```bash
bun test && bun run lint
```
Expected: all pass.

**Step 4: Commit**

```bash
git add .claude/skills/
git commit -m "chore: migrate .claude/skills to Agent Skills directory format"
```

---

### Task 6: Final verification

**Step 1: Run full test + lint suite**

```bash
bun test && bun run lint
```
Expected: all tests pass, no lint errors.

**Step 2: Verify the build compiles**

```bash
bun run build:darwin-arm64
```
Expected: `dist/aitool-darwin-arm64` produced with no errors.
