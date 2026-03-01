// tests/agents/continue_spec.ts
import {describe, expect, test} from 'bun:test';
import {ContinueAgent, continueAgent} from '../../src/agents/continue.js';
import {type Executor} from '../../src/agents/agent.js';

describe('continueAgent agent', () => {
	test('has correct id and displayName', () => {
		expect(continueAgent.id).toBe('continue');
		expect(continueAgent.displayName).toBe('Continue');
	});

	test('exposes a check() method', () => {
		expect(continueAgent.check).toBeDefined();
	});
});

describe('ContinueAgent', () => {
	test('returns installed:true with version when cn --version succeeds', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'cn --version') return 'cn 0.1.0\n';
			throw new Error('not found');
		};
		const result = await new ContinueAgent(exec).check();
		expect(result.installed).toBe(true);
		expect(result.version).toBe('cn 0.1.0');
	});

	test('falls back to which and returns path when --version fails', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'which cn') return '/usr/local/bin/cn\n';
			throw new Error('not found');
		};
		const result = await new ContinueAgent(exec).check();
		expect(result.installed).toBe(true);
		expect(result.path).toBe('/usr/local/bin/cn');
		expect(result.version).toBeUndefined();
	});

	test('returns installed:false when both commands fail', async () => {
		const exec: Executor = () => {
			throw new Error('not found');
		};
		const result = await new ContinueAgent(exec).check();
		expect(result.installed).toBe(false);
		expect(result.error).toBeTruthy();
	});
});
