// src/commands/agentInstall.ts
import {AGENT_REGISTRY} from '../agents/index.js';

export type AgentInstallOptions = {
	/** Agent id to look up (e.g. "claude-code"). */
	agent: string;
	/** Output raw JSON instead of human-readable text. */
	json?: boolean;
	/** When true, suppress plain-text console output (caller will render a TUI). */
	silent?: boolean;
};

export type AgentInstallResult = {
	id: string;
	displayName: string;
	url: string;
	installUrl: string | undefined;
};

/**
 * Looks up the installation URL for the given agent and prints it.
 * Exits with code 1 for unknown agents.
 */
export function runAgentInstall(
	options: AgentInstallOptions,
): AgentInstallResult {
	const {agent: agentId, json = false, silent = false} = options;

	const agent = AGENT_REGISTRY.find(a => a.id === agentId);
	if (!agent) {
		const valid = AGENT_REGISTRY.map(a => a.id).join(', ');
		console.error(`Unknown agent "${agentId}". Valid options: ${valid}`);
		process.exit(1);
	}

	const result: AgentInstallResult = {
		id: agent.id,
		displayName: agent.displayName,
		url: agent.url,
		installUrl: agent.installUrl,
	};

	if (json) {
		console.log(JSON.stringify(result, null, 2));
		return result;
	}

	if (!silent) {
		if (agent.installUrl) {
			console.log(`${agent.displayName} install page:`);
			console.log(`  ${agent.installUrl}`);
		} else {
			console.log(
				`No install page is registered for ${agent.displayName}. ` +
					`See the website instead: ${agent.url}`,
			);
		}
	}

	return result;
}
