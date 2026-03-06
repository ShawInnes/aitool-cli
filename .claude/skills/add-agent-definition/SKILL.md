---
name: add-agent-definition
description: Add a New Agent Definition
---

# Add a New Agent Definition

`Agent` is a TypeScript **interface** (defined in `src/agents/agent.ts`) — implement it as a class or plain object.

Key members:

- `id` (`readonly string`): machine-readable CLI arg (e.g. `"my-agent"`)
- `displayName` (`readonly string`): human-readable name
- `url` (`readonly string`): official website URL
- `githubUrl?` (`readonly string`): GitHub repo URL — omit for closed-source agents
- `check?()`: optional; returns `Promise<AgentCheckResult>` — must **never throw**; return `{installed: false, error: "..."}` on failure

Steps:

1. Create `src/agents/<name>.ts` implementing `Agent`. Accept an injectable `Executor` for testability (see `claudeCode.ts` for the pattern).
2. Export the class and a singleton instance from `src/agents/index.ts` and add the instance to `AGENT_REGISTRY`.
3. Add tests to `tests/agents/<name>_spec.ts` following the existing `describe`/`test` pattern.

## Pattern (from `claudeCode.ts`)

```ts
import {execSync as nodeExecSync} from 'node:child_process';
import {type Agent, type AgentCheckResult, type Executor} from './agent.js';

export class MyAgent implements Agent {
	readonly id = 'my-agent';
	readonly displayName = 'My Agent';
	readonly url = 'https://myagent.example.com';
	readonly githubUrl = 'https://github.com/example/my-agent'; // omit if closed-source
	private readonly exec: Executor;

	constructor(exec: Executor = nodeExecSync as unknown as Executor) {
		this.exec = exec;
	}

	async check(): Promise<AgentCheckResult> {
		try {
			const output = this.exec('myagent --version', {
				stdio: 'pipe',
				encoding: 'utf8',
			}).trim();
			return {installed: true, version: output.split('\n')[0]?.trim()};
		} catch {}

		const whichCmd =
			process.platform === 'win32' ? 'where myagent' : 'which myagent';
		try {
			const path =
				this.exec(whichCmd, {stdio: 'pipe', encoding: 'utf8'})
					.split('\n')[0]
					?.trim() ?? '';
			return {installed: true, path};
		} catch {
			return {installed: false, error: 'binary "myagent" not found in PATH'};
		}
	}
}

export const myAgent: Agent = new MyAgent();
```
