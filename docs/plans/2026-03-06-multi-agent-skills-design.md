# Multi-Agent Skills Support Design

**Date:** 2026-03-06
**Status:** Approved

## Problem

`aitool skills install` and `aitool skills update` currently only link skills to
`~/.claude/skills/` — Claude Code's personal skills directory. Open Code and
Crush both support the same Agent Skills open standard format at `~/.agents/skills/`,
so installed skills should be linked there as well to work across all three agents.

## Background

All three agents (Claude Code, Open Code, Crush) use the Agent Skills open
standard directory format:

```
<base>/
  <skill-name>/
    SKILL.md        ← required: YAML frontmatter + instructions
    scripts/        ← optional
    assets/         ← optional
```

The base path differs by agent:

| Agent      | Base path             |
|------------|-----------------------|
| Claude Code | `~/.claude/skills/`  |
| Open Code  | `~/.agents/skills/`   |
| Crush      | `~/.agents/skills/`   |

Since Open Code and Crush share the same base path, a single additional symlink
target covers both.

Continue uses a different format (`~/.continue/prompts/`) and is out of scope.

## Design

### New path helper

Add `getAgentsSkillsDir()` to `src/config/paths.ts`:

```ts
export function getAgentsSkillsDir(): string {
  return path.join(homeDir(), '.agents', 'skills');
}
```

### Skills install

`src/commands/skillsInstall.ts` currently iterates entries in `skills/` and
symlinks each to `~/.claude/skills/`. After this change it will also symlink
each entry to `~/.agents/skills/`, creating that directory if it doesn't exist.

The result type gains a second links array `agentLinks: SkillLinkResult[]`
(parallel structure to `links`) so callers can report both targets.

### Skills update

`src/commands/skillsUpdate.ts` applies the same logic: for each repo, link new
skill directories to both `~/.claude/skills/` and `~/.agents/skills/`.

### TUI components

`SkillsInstall.tsx` and `SkillsUpdate.tsx` are updated to render both link
sets, grouped by destination so the output is easy to scan:

```
  ~/.claude/skills/
    linked: commit
    linked: testing
  ~/.agents/skills/
    linked: commit
    linked: testing
```

### Existing project skills migration

The existing flat `.md` files under `.claude/skills/` in this repo are the
legacy format. They are converted to the directory format
(`<name>/SKILL.md`) so the repo itself follows the Agent Skills standard.

## Non-goals

- Continue support (different format, different path)
- Any agent-selection flag (`--target`) — all agents are always linked
- Format conversion at install time (repos are expected to use the directory format)
