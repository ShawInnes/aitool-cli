---
name: testing
description: A skill to add and run tests in this project
---

# Testing

- Runner: `bun test`
- Test files live under `tests/` — agent tests are grouped in `tests/agents/` (e.g. `tests/agents/claudeCode_spec.ts`), cross-cutting tests at the root (e.g. `tests/registry_spec.ts`)
- Import from `bun:test`: `describe`, `test`, `expect`

## Running tests

```sh
bun test tests/agents/claudeCode_spec.ts   # specific file
bun test tests/                            # all test files
```

## Patterns

- Inject fakes via constructor — no mocking framework needed
- `check()` methods must never throw; verify `installed: false` + truthy `error` on failure paths

```ts
describe('MyChecker', () => {
	test('installed with version', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'myagent --version') return 'myagent 1.0.0\n';
			throw new Error('not found');
		};
		const result = await new MyChecker(exec).check();
		expect(result.installed).toBe(true);
		expect(result.version).toBe('myagent 1.0.0');
	});

	test('not installed', async () => {
		const exec: Executor = () => {
			throw new Error('not found');
		};
		const result = await new MyChecker(exec).check();
		expect(result.installed).toBe(false);
		expect(result.error).toBeTruthy();
	});
});
```
