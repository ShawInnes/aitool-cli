// tests/agents_spec.ts
import {describe, expect, test} from 'bun:test';
import {ClaudeCodeAgent, claudeCode} from '../src/agents/claudeCode.js';
import {OpenCodeAgent, openCode} from '../src/agents/openCode.js';
import {AGENT_REGISTRY} from '../src/agents/index.js';
import {type Executor} from '../src/agents/agent.js';

// ─── claudeCode Agent ────────────────────────────────────────────────────────

describe('claudeCode agent', () => {
	test('has correct id and displayName', () => {
		expect(claudeCode.id).toBe('claude-code');
		expect(claudeCode.displayName).toBe('Claude Code');
	});

	test('exposes a check() method', () => {
		expect(claudeCode.check).toBeDefined();
	});
});

// ─── ClaudeCodeAgent ─────────────────────────────────────────────────────────

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

// ─── openCode Agent ──────────────────────────────────────────────────────────

describe('openCode agent', () => {
	test('has correct id and displayName', () => {
		expect(openCode.id).toBe('opencode');
		expect(openCode.displayName).toBe('Open Code');
	});

	test('exposes a check() method', () => {
		expect(openCode.check).toBeDefined();
	});
});

// ─── OpenCodeAgent ───────────────────────────────────────────────────────────

describe('OpenCodeAgent', () => {
	test('returns installed:true with version when opencode --version succeeds', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'opencode --version') return 'opencode 0.5.0\n';
			throw new Error('not found');
		};
		const result = await new OpenCodeAgent(exec).check();
		expect(result.installed).toBe(true);
		expect(result.version).toBe('opencode 0.5.0');
	});

	test('falls back to which and returns path when --version fails', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'which opencode') return '/usr/local/bin/opencode\n';
			throw new Error('not found');
		};
		const result = await new OpenCodeAgent(exec).check();
		expect(result.installed).toBe(true);
		expect(result.path).toBe('/usr/local/bin/opencode');
		expect(result.version).toBeUndefined();
	});

	test('returns installed:false when both commands fail', async () => {
		const exec: Executor = () => {
			throw new Error('not found');
		};
		const result = await new OpenCodeAgent(exec).check();
		expect(result.installed).toBe(false);
		expect(result.error).toBeTruthy();
	});
});

// ─── Registry ────────────────────────────────────────────────────────────────

describe('AGENT_REGISTRY', () => {
	test('contains claude-code and opencode', () => {
		const ids = AGENT_REGISTRY.map(a => a.id);
		expect(ids).toContain('claude-code');
		expect(ids).toContain('opencode');
	});

	test('all agents implement check() capability', () => {
		for (const agent of AGENT_REGISTRY) {
			expect(agent.check).toBeDefined();
		}
	});
});
