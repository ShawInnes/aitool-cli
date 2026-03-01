# Agent List Command Design

**Goal:** Add `aitool agent list` to display the supported agent types in a TUI table (with plain-text fallback).

**Approach:** Option A — no interface changes. Use `id` and `displayName` from the existing `AGENT_REGISTRY` as-is. Two columns: ID and Name.

**Output (TUI and plain text):**

```
ID           Name
──────────── ──────────
claude-code  Claude Code
opencode     Open Code
```

**Architecture:**
- `src/commands/agentList.ts` — `runAgentList()` plain-text fallback (no Commander import)
- `src/components/AgentList.tsx` — Ink component rendering the two-column table
- `src/cli.tsx` — add `agent list` subcommand under the existing `agentCommand`

**TUI component:** Uses `Box`/`Text` from Ink, consistent with existing components (`AuthStatus`, `AuthUserinfo`). No third-party table library.

**Pattern:** Follows the established `isTuiMode()` → `render(<Component />)` vs `console.log` pattern seen in `auth status`.
