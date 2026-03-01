import {AGENT_REGISTRY, type AgentChecker} from '../agents/index.js';

export type AgentCheckOptions = {
	/** If provided, only check the agent with this id. Check all if omitted. */
	agent?: string;
	/** Emit results as JSON instead of human-readable text. */
	json?: boolean;
};

export type AgentCheckSummary = {
	id: string;
	displayName: string;
	installed: boolean;
	version?: string;
	path?: string;
	error?: string;
};

/**
 * Runs install checks for one or all registered agents and prints the results.
 *
 * @param options.agent - optional agent id to check (e.g. "claude-code").
 *                        When omitted, all agents in AGENT_REGISTRY are checked.
 * @param options.json  - when true, print a JSON array instead of plain text.
 */
export async function runAgentCheck(
	options: AgentCheckOptions = {},
): Promise<void> {
	const {agent: agentId, json = false} = options;

	// Resolve which checkers to run
	let checkers: AgentChecker[];
	if (agentId) {
		const found = AGENT_REGISTRY.find(c => c.id === agentId);
		if (!found) {
			const valid = AGENT_REGISTRY.map(c => c.id).join(', ');
			console.error(`Unknown agent "${agentId}". Valid options: ${valid}`);
			process.exit(1);
		}

		checkers = [found];
	} else {
		checkers = AGENT_REGISTRY;
	}

	// Run all checks in parallel
	const results: AgentCheckSummary[] = await Promise.all(
		checkers.map(async c => {
			const result = await c.check();
			return {id: c.id, displayName: c.displayName, ...result};
		}),
	);

	if (json) {
		console.log(JSON.stringify(results, null, 2));
		return;
	}

	// Human-readable output
	for (const r of results) {
		const status = r.installed ? '✓ installed' : '✗ not installed';
		const detail = r.version
			? ` (${r.version})`
			: r.path
				? ` (${r.path})`
				: r.error
					? ` — ${r.error}`
					: '';
		console.log(`${r.displayName.padEnd(14)} ${status}${detail}`);
	}
}
