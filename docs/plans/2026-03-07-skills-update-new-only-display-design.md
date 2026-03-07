# Design: Skills Update — Show Only Newly Linked Skills

**Date:** 2026-03-07

## Problem

`aitool skills update` calls `linkSkillEntries` after every pull. This correctly links any new skills added manually to a cloned repo's `skills/` directory. However, the output shows all link results — including `skipped: already exists` for every skill that was already linked. This is noisy and obscures what actually changed.

## Solution

Filter the display layer in both the plain-text (`printResult`) and TUI (`SkillsUpdate.tsx`) paths to only show entries with `status === 'linked'`. Only render the `~/.claude/skills/` and `~/.agents/skills/` sections if there are any newly-linked skills.

The `SkillsUpdateRepoResult` data shape is unchanged — the command layer returns the full link list.

## Scope

- `src/commands/skillsUpdate.ts` — filter in `printResult`
- `src/components/SkillsUpdate.tsx` — filter in `RepoBlock`

## Non-goals

- No change to `linkSkillEntries` signature or return shape
- No change to install command output (all links are new on install)
- No `newOnly` flag or API extension
