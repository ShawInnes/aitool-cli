# skills update — Design

## Summary

`aitool skills update` (no arguments) pulls the latest changes for every repo
in `~/.agent-skills/` and symlinks any new `skills/` entries into
`~/.claude/skills/`. Already-linked skills are silently skipped.

## Command

```
aitool skills update [--json]
```

No positional argument — always operates on every installed repo.

## Behavior

1. Read `~/.agent-skills/` subdirectories. If none exist, exit with a clear
   "nothing installed" message.
2. For each repo directory:
   a. Run `git pull` in that directory.
   b. If pull fails, record the error and continue to the next repo.
   c. Check for a `skills/` subdirectory. If absent, skip linking.
   d. For each entry in `skills/`: symlink into `~/.claude/skills/` if not
      already present. Broken symlinks count as existing and are skipped.
3. Report results — one block per repo in TUI mode, array of objects in JSON.

## Types

```typescript
// SkillLinkResult imported from skillsInstall.ts (reuse)
type SkillsUpdateRepoResult = {
  repoName: string;
  pulled: boolean;
  hasSkillsDir: boolean;
  links: SkillLinkResult[];
  error?: string;
};
```

## Three-layer structure

| Layer     | File                               |
|-----------|------------------------------------|
| Command   | `src/commands/skillsUpdate.ts`     |
| Component | `src/components/SkillsUpdate.tsx`  |
| CLI wire  | `src/cli.tsx` (`skillsCommand`)    |

## TUI output

```
aitool — Skills Update
┌──────────────────────────────────┐
│ ✓ pulled my-skills-repo          │
│ ✓ found skills/ directory        │
│   ✓ linked: new-skill            │
│   ⚠ skipped: old-skill (already exists) │
└──────────────────────────────────┘
```

If nothing installed:

```
┌────────────────────────────────────────┐
│ ✗ no skills repos found in ~/.agent-skills/ │
└────────────────────────────────────────┘
```
