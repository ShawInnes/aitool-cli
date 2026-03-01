// tests/claudeCode_spec.ts
import {describe, expect, test} from 'bun:test';
import {ClaudeCodeAgent, claudeCode} from '../../src/agents/claudeCode.js';
import {type Executor} from '../../src/agents/agent.js';

describe('claudeCode agent', () => {
	test('has correct id and displayName', () => {
		expect(claudeCode.id).toBe('claude-code');
		expect(claudeCode.displayName).toBe('Claude Code');
	});

	test('exposes a check() method', () => {
		expect(claudeCode.check).toBeDefined();
	});
});

describe('ClaudeCodeAgent', () => {
	test('returns installed:true with version when claude --version succeeds', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'claude --version') return 'claude 1.2.3\n';
			throw new Error('not found');
		};
		const result = await new ClaudeCodeAgent(exec).check();
		expect(result.installed).toBe(true);
		expect(result.version).toBe('claude 1.2.3');
	});

	test('falls back to which and returns path when --version fails', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'which claude') return '/usr/local/bin/claude\n';
			throw new Error('not found');
		};
		const result = await new ClaudeCodeAgent(exec).check();
		expect(result.installed).toBe(true);
		expect(result.path).toBe('/usr/local/bin/claude');
		expect(result.version).toBeUndefined();
	});

	test('returns installed:false when both commands fail', async () => {
		const exec: Executor = () => {
			throw new Error('not found');
		};
		const result = await new ClaudeCodeAgent(exec).check();
		expect(result.installed).toBe(false);
		expect(result.error).toBeTruthy();
	});
});
