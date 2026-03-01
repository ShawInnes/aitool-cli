// tests/crush_spec.ts
import {describe, expect, test} from 'bun:test';
import {CrushAgent, crush} from '../../src/agents/crush.js';
import {type Executor} from '../../src/agents/agent.js';

describe('crush agent', () => {
	test('has correct id and displayName', () => {
		expect(crush.id).toBe('crush');
		expect(crush.displayName).toBe('Crush');
	});

	test('exposes a check() method', () => {
		expect(crush.check).toBeDefined();
	});
});

describe('CrushAgent', () => {
	test('returns installed:true with version when crush --version succeeds', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'crush --version') return 'crush 0.1.0\n';
			throw new Error('not found');
		};
		const result = await new CrushAgent(exec).check();
		expect(result.installed).toBe(true);
		expect(result.version).toBe('crush 0.1.0');
	});

	test('falls back to which and returns path when --version fails', async () => {
		const exec: Executor = cmd => {
			if (cmd === 'which crush') return '/usr/local/bin/crush\n';
			throw new Error('not found');
		};
		const result = await new CrushAgent(exec).check();
		expect(result.installed).toBe(true);
		expect(result.path).toBe('/usr/local/bin/crush');
		expect(result.version).toBeUndefined();
	});

	test('returns installed:false when both commands fail', async () => {
		const exec: Executor = () => {
			throw new Error('not found');
		};
		const result = await new CrushAgent(exec).check();
		expect(result.installed).toBe(false);
		expect(result.error).toBeTruthy();
	});
});
