// tests/registry_spec.ts
import {describe, expect, test} from 'bun:test';
import {AGENT_REGISTRY} from '../src/agents/index.js';

describe('AGENT_REGISTRY', () => {
	test('contains claude-code, opencode, and crush', () => {
		const ids = AGENT_REGISTRY.map(a => a.id);
		expect(ids).toContain('claude-code');
		expect(ids).toContain('opencode');
		expect(ids).toContain('crush');
	});

	test('all agents implement check() capability', () => {
		for (const agent of AGENT_REGISTRY) {
			expect(agent.check).toBeDefined();
		}
	});
});
