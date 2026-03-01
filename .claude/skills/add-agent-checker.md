# Add a New Agent Checker

1. Create `src/agents/<name>.ts` implementing the `AgentChecker` interface (see `agent.ts`):
   - `id`: machine-readable CLI arg (e.g. `"claude-code"`)
   - `displayName`: human-readable name
   - `check()`: must never throw — return `{installed: false, error: "..."}` on failure
   - Accept an injectable `Executor` for testability (see `claudeCode.ts` for the pattern)
2. Export from `src/agents/index.ts` and add an instance to `AGENT_REGISTRY`.
3. Add tests to `test-agents.ts` following the existing `describe`/`test` pattern.

## Pattern (from `claudeCode.ts`)

```ts
export class MyAgentChecker implements AgentChecker {
  readonly id = 'my-agent';
  readonly displayName = 'My Agent';
  private readonly exec: Executor;

  constructor(exec: Executor = execSync as unknown as Executor) {
    this.exec = exec;
  }

  async check(): Promise<AgentCheckResult> {
    try {
      const output = this.exec('myagent --version', { stdio: 'pipe', encoding: 'utf8' }).trim();
      return { installed: true, version: output.split('\n')[0]?.trim() };
    } catch {}

    const whichCmd = process.platform === 'win32' ? 'where myagent' : 'which myagent';
    try {
      const path = this.exec(whichCmd, { stdio: 'pipe', encoding: 'utf8' }).split('\n')[0]?.trim() ?? '';
      return { installed: true, path };
    } catch {
      return { installed: false, error: 'binary "myagent" not found in PATH' };
    }
  }
}
```
