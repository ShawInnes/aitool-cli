# Agents

Agent configuration is stored in [`docs/agents.json`](./agents.json).

Each entry has the following fields:

| Field | Type | Description |
| --- | --- | --- |
| `tag` | string | Machine-readable identifier used as CLI argument |
| `name` | string | Human-readable display name |
| `website` | string | Agent's official website URL |
| `github` | string \| null | GitHub repository URL (null if closed source or unknown) |
| `description` | string | Brief description of the agent |
| `opensource` | boolean | Whether the agent is open source |
| `supported` | boolean | Whether `aitool` supports this agent |
| `configFile` | object \| null | Platform-specific config file paths (`mac`, `linux`, `windows`), or null if not applicable |

## Notable Findings

- crush is the successor to OpenCode, built by Charmbracelet after the original creator joined them
- clawdbot evolved into OpenClaw after going through several name changes
- qwen and qoder are both Alibaba products but serve different purposes (CLI agent vs. full IDE platform)
- droid is Factory AI's product — it topped the Terminal-Bench benchmark
