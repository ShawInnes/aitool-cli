---
name: commit
description: Commit staged changes with a suitable conventional commit message
---

# Commit Changes

This project uses **conventional commits**: `type(scope): short description`

## Commit Types

| Type       | When to use                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | New feature or capability                       |
| `fix`      | Bug fix                                         |
| `refactor` | Code change that is neither a fix nor a feature |
| `test`     | Adding or updating tests                        |
| `docs`     | Documentation only                              |
| `chore`    | Tooling, config, deps, CI — no production code  |
| `style`    | Formatting, whitespace — no logic change        |

## Scope

Use the affected area in parentheses when it adds clarity (e.g. `agent`, `auth`, `config`). Omit when the change is broad or cross-cutting.

## Process

1. Run `git status` and `git diff` to understand what changed.
2. Stage relevant files: `git add <files>` (never stage `.env`, secrets, or unrelated files).
3. Draft a message:
   - Subject line: `type(scope): imperative, lowercase, ≤72 chars, no period`
   - Body (optional): explain _why_, not _what_, wrapped at 72 chars
4. Commit: `git commit -m "type(scope): description"`
5. Run `git status` to confirm the working tree is clean.

## Examples

```sh
git commit -m "feat(agent): add Crush agent definition and check logic"
git commit -m "fix(auth): handle token refresh race condition"
git commit -m "refactor(agent): split agents_spec into per-agent files"
git commit -m "chore: update dependencies"
git commit -m "docs: correct test file paths in add-agent-definition skill"
```
