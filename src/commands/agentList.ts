import {AGENT_REGISTRY} from '../agents/index.js';

export type AgentListOptions = {
	json?: boolean;
};

export type AgentListEntry = {
	id: string;
	displayName: string;
	capabilities: string[];
};

export function runAgentList(options: AgentListOptions = {}): void {
	const {json = false} = options;

	const entries: AgentListEntry[] = AGENT_REGISTRY.map(agent => {
		const capabilities: string[] = [];
		if (agent.check) capabilities.push('install-check');
		return {id: agent.id, displayName: agent.displayName, capabilities};
	});

	if (json) {
		console.log(JSON.stringify(entries, null, 2));
		return;
	}

	for (const entry of entries) {
		console.log(`${entry.id.padEnd(16)} ${entry.displayName}`);
		if (entry.capabilities.length > 0) {
			console.log(
				`${''.padEnd(16)} capabilities: ${entry.capabilities.join(', ')}`,
			);
		}
	}
}
