# Testing

- Runner: `bun test`
- Test files live in the tests/ root (e.g. `tests/agents_spec.ts`)
- Import from `bun:test`: `describe`, `test`, `expect`

## Running tests

```sh
bun test tests/agents_spec.ts   # specific file
bun test                  # all test files
```

## Patterns

- Inject fakes via constructor — no mocking framework needed
- `check()` methods must never throw; verify `installed: false` + truthy `error` on failure paths

```ts
describe('MyChecker', () => {
  test('installed with version', async () => {
    const exec: Executor = (cmd) => {
      if (cmd === 'myagent --version') return 'myagent 1.0.0\n';
      throw new Error('not found');
    };
    const result = await new MyChecker(exec).check();
    expect(result.installed).toBe(true);
    expect(result.version).toBe('myagent 1.0.0');
  });

  test('not installed', async () => {
    const exec: Executor = () => { throw new Error('not found'); };
    const result = await new MyChecker(exec).check();
    expect(result.installed).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
```
