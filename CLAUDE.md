# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install       # Install dependencies
bun dev           # Run in watch mode (hot-reload)
bun run src/index.ts  # Run directly
```

No test or lint scripts are configured yet.

## Architecture

This is a TUI (Terminal User Interface) application built with [OpenTUI](https://git.new/create-tui) (`@opentui/core`), running on the Bun runtime.

**Stack:**
- Runtime: Bun
- Language: TypeScript (ESNext, strict)
- TUI framework: `@opentui/core` — wraps a native Zig core with a component API

**UI model:** Functional components composed into a tree and attached to `renderer.root`. Layout uses a flexbox-inspired system (`alignItems`, `justifyContent`, `flexGrow`). Core primitives: `Box`, `Text`, `ASCIIFont`.

**Renderer pattern:**
```typescript
const renderer = await createCliRenderer({ exitOnCtrlC: true });
renderer.root.add(Box(..., Text(...)));
```

**Planned direction:** The TODO references LiteLLM's model prices/context window JSON, suggesting integration with language model APIs is the intended next feature area.
