// src/agents/agent.ts

/**
 * Result of checking whether an AI coding agent is installed.
 */
export type AgentCheckResult = {
	installed: boolean;
	version?: string;
	path?: string;
	error?: string;
};

/**
 * Interface for an AI coding agent installation checker.
 *
 * Each implementing class knows how to detect a specific agent binary
 * and extract its version string. The `check()` method must never throw —
 * it should return `installed: false` with an optional error message
 * when detection fails for any reason.
 */
export interface AgentChecker {
	/** Machine-readable identifier used as the CLI argument (e.g. "claude-code") */
	readonly id: string;
	/** Human-readable display name (e.g. "Claude Code") */
	readonly displayName: string;

	/**
	 * Checks whether this agent is installed on the current system.
	 *
	 * Returns a resolved promise — never rejects.
	 */
	check(): Promise<AgentCheckResult>;
}
