import {AGENT_REGISTRY} from '../agents/index.js';

export type AgentListOptions = {
	json?: boolean;
};

export type AgentListEntry = {
	id: string;
	displayName: string;
	url: string;
	githubUrl?: string;
};

export function runAgentList(options: AgentListOptions = {}): void {
	const {json = false} = options;

	const entries: AgentListEntry[] = AGENT_REGISTRY.map(agent => ({
		id: agent.id,
		displayName: agent.displayName,
		url: agent.url,
		...(agent.githubUrl ? {githubUrl: agent.githubUrl} : {}),
	}));

	if (json) {
		console.log(JSON.stringify(entries, null, 2));
		return;
	}

	for (const entry of entries) {
		console.log(
			`${entry.id.padEnd(16)} ${entry.displayName.padEnd(16)} ${entry.url}`,
		);
	}
}
