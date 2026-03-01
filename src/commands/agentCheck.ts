import {AGENT_REGISTRY, type Agent} from '../agents/index.js';

export type AgentCheckOptions = {
	/** If provided, only check the agent with this id. Check all if omitted. */
	agent?: string;
	/** Emit results as JSON instead of human-readable text. */
	json?: boolean;
	/** When true, suppress plain-text console output (caller will render a TUI). */
	silent?: boolean;
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
 * Only agents that implement a `check()` method are checked.
 *
 * @param options.agent - optional agent id to check (e.g. "claude-code").
 *                        When omitted, all agents in AGENT_REGISTRY are checked.
 * @param options.json  - when true, print a JSON array instead of plain text.
 */
export async function runAgentCheck(
	options: AgentCheckOptions = {},
): Promise<AgentCheckSummary[]> {
	const {agent: agentId, json = false, silent = false} = options;

	let agents: Agent[];
	if (agentId) {
		const found = AGENT_REGISTRY.find(a => a.id === agentId);
		if (!found) {
			const valid = AGENT_REGISTRY.map(a => a.id).join(', ');
			console.error(`Unknown agent "${agentId}". Valid options: ${valid}`);
			process.exit(1);
		}

		agents = [found];
	} else {
		agents = AGENT_REGISTRY;
	}

	const checkable = agents.filter(a => a.check !== undefined);

	// Run all checks in parallel
	const results: AgentCheckSummary[] = await Promise.all(
		checkable.map(async a => {
			const result = await a.check!();
			return {id: a.id, displayName: a.displayName, ...result};
		}),
	);

	if (json) {
		console.log(JSON.stringify(results, null, 2));
		return results;
	}

	if (!silent) {
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

	return results;
}
