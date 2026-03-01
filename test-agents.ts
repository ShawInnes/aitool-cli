// test-agents.ts
import {describe, expect, test} from 'bun:test';
import {ClaudeCodeChecker} from './src/agents/claudeCode.js';
import {OpenCodeChecker} from './src/agents/openCode.js';
import {AGENT_REGISTRY} from './src/agents/index.js';
import {type Executor} from './src/agents/agent.js';

// ─── ClaudeCodeChecker ──────────────────────────────────────────────────────

describe('ClaudeCodeChecker', () => {
	test('has correct id and displayName', () => {
		const checker = new ClaudeCodeChecker();
		expect(checker.id).toBe('claude-code');
		expect(checker.displayName).toBe('Claude Code');
	});

	test('returns installed:true with version when claude --version succeeds', async () => {
		const exec: Executor = (cmd) => {
			if (cmd === 'claude --version') return 'claude 1.2.3\n';
			throw new Error('not found');
		};
		const result = await new ClaudeCodeChecker(exec).check();
		expect(result.installed).toBe(true);
		expect(result.version).toBe('claude 1.2.3');
	});

	test('falls back to which and returns path when --version fails', async () => {
		const exec: Executor = (cmd) => {
			if (cmd === 'which claude') return '/usr/local/bin/claude\n';
			throw new Error('not found');
		};
		const result = await new ClaudeCodeChecker(exec).check();
		expect(result.installed).toBe(true);
		expect(result.path).toBe('/usr/local/bin/claude');
		expect(result.version).toBeUndefined();
	});

	test('returns installed:false when both commands fail', async () => {
		const exec: Executor = () => {
			throw new Error('not found');
		};
		const result = await new ClaudeCodeChecker(exec).check();
		expect(result.installed).toBe(false);
		expect(result.error).toBeTruthy();
	});
});

// ─── OpenCodeChecker ────────────────────────────────────────────────────────

describe('OpenCodeChecker', () => {
	test('has correct id and displayName', () => {
		const checker = new OpenCodeChecker();
		expect(checker.id).toBe('opencode');
		expect(checker.displayName).toBe('Open Code');
	});

	test('returns installed:true with version when opencode --version succeeds', async () => {
		const exec: Executor = (cmd) => {
			if (cmd === 'opencode --version') return 'opencode 0.5.0\n';
			throw new Error('not found');
		};
		const result = await new OpenCodeChecker(exec).check();
		expect(result.installed).toBe(true);
		expect(result.version).toBe('opencode 0.5.0');
	});

	test('falls back to which and returns path when --version fails', async () => {
		const exec: Executor = (cmd) => {
			if (cmd === 'which opencode') return '/usr/local/bin/opencode\n';
			throw new Error('not found');
		};
		const result = await new OpenCodeChecker(exec).check();
		expect(result.installed).toBe(true);
		expect(result.path).toBe('/usr/local/bin/opencode');
		expect(result.version).toBeUndefined();
	});

	test('returns installed:false when both commands fail', async () => {
		const exec: Executor = () => {
			throw new Error('not found');
		};
		const result = await new OpenCodeChecker(exec).check();
		expect(result.installed).toBe(false);
		expect(result.error).toBeTruthy();
	});
});

// ─── Registry ───────────────────────────────────────────────────────────────

describe('AGENT_REGISTRY', () => {
	test('contains claude-code and opencode', () => {
		const ids = AGENT_REGISTRY.map(a => a.id);
		expect(ids).toContain('claude-code');
		expect(ids).toContain('opencode');
	});
});
