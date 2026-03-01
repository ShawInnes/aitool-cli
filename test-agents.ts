// test-agents.ts
import test, {type ExecutionContext} from 'ava';
import {ClaudeCodeChecker} from './src/agents/claudeCode.js';
import {OpenCodeChecker} from './src/agents/openCode.js';
import {AGENT_REGISTRY} from './src/agents/index.js';

// ─── ClaudeCodeChecker ──────────────────────────────────────────────────────

test('ClaudeCodeChecker has correct id and displayName', (t: ExecutionContext) => {
	const checker = new ClaudeCodeChecker();
	t.is(checker.id, 'claude-code');
	t.is(checker.displayName, 'Claude Code');
});

test('ClaudeCodeChecker.check() returns installed:true with version when claude --version succeeds', async (t: ExecutionContext) => {
	const checker = new ClaudeCodeChecker((cmd: string, _opts: {stdio: string; encoding: string}) => {
		if (cmd === 'claude --version') return 'claude 1.2.3\n';
		throw new Error('not found');
	});
	const result = await checker.check();
	t.true(result.installed);
	t.is(result.version, 'claude 1.2.3');
});

test('ClaudeCodeChecker.check() falls back to which and returns path when --version fails', async (t: ExecutionContext) => {
	const checker = new ClaudeCodeChecker((cmd: string, _opts: {stdio: string; encoding: string}) => {
		if (cmd === 'which claude') return '/usr/local/bin/claude\n';
		throw new Error('not found');
	});
	const result = await checker.check();
	t.true(result.installed);
	t.is(result.path, '/usr/local/bin/claude');
	t.is(result.version, undefined);
});

test('ClaudeCodeChecker.check() returns installed:false when both commands fail', async (t: ExecutionContext) => {
	const checker = new ClaudeCodeChecker((_cmd: string, _opts: {stdio: string; encoding: string}) => {
		throw new Error('not found');
	});
	const result = await checker.check();
	t.false(result.installed);
	t.truthy(result.error);
});

// ─── OpenCodeChecker ────────────────────────────────────────────────────────

test('OpenCodeChecker has correct id and displayName', (t: ExecutionContext) => {
	const checker = new OpenCodeChecker();
	t.is(checker.id, 'opencode');
	t.is(checker.displayName, 'Open Code');
});

test('OpenCodeChecker.check() returns installed:true with version when opencode --version succeeds', async (t: ExecutionContext) => {
	const checker = new OpenCodeChecker((cmd: string, _opts: {stdio: string; encoding: string}) => {
		if (cmd === 'opencode --version') return 'opencode 0.5.0\n';
		throw new Error('not found');
	});
	const result = await checker.check();
	t.true(result.installed);
	t.is(result.version, 'opencode 0.5.0');
});

test('OpenCodeChecker.check() falls back to which and returns path when --version fails', async (t: ExecutionContext) => {
	const checker = new OpenCodeChecker((cmd: string, _opts: {stdio: string; encoding: string}) => {
		if (cmd === 'which opencode') return '/usr/local/bin/opencode\n';
		throw new Error('not found');
	});
	const result = await checker.check();
	t.true(result.installed);
	t.is(result.path, '/usr/local/bin/opencode');
	t.is(result.version, undefined);
});

test('OpenCodeChecker.check() returns installed:false when both commands fail', async (t: ExecutionContext) => {
	const checker = new OpenCodeChecker((_cmd: string, _opts: {stdio: string; encoding: string}) => {
		throw new Error('not found');
	});
	const result = await checker.check();
	t.false(result.installed);
	t.truthy(result.error);
});

// ─── Registry ───────────────────────────────────────────────────────────────

test('AGENT_REGISTRY contains claude-code and opencode', (t: ExecutionContext) => {
	const ids = AGENT_REGISTRY.map(a => a.id);
	t.true(ids.includes('claude-code'));
	t.true(ids.includes('opencode'));
});
