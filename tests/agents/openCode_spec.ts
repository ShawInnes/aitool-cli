// tests/openCode_spec.ts
import {describe, expect, test} from 'bun:test';
import {OpenCodeAgent, openCode} from '../../src/agents/openCode.js';
import {type Executor} from '../../src/agents/agent.js';

describe('openCode agent', () => {
	test('has correct id and displayName', () => {
		expect(openCode.id).toBe('opencode');
		expect(openCode.displayName).toBe('Open Code');
	});

	test('exposes a check() method', () => {
		expect(openCode.check).toBeDefined();
	});
});

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
