// src/agents/agent.ts

/** Executor function type for running shell commands — matches `execSync` signature. */
export type Executor = (
	cmd: string,
	opts: {stdio: string; encoding: string},
) => string;

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
 * Represents a registered AI coding agent.
 *
 * An Agent carries its identity (id, displayName) and may implement optional
 * capabilities directly. The `check()` method, if present, detects whether this
 * agent is installed on the current system and must never throw — it should
 * return `installed: false` with an optional error message when detection fails.
 */
export interface Agent {
	/** Machine-readable identifier used as the CLI argument (e.g. "claude-code") */
	readonly id: string;
	/** Human-readable display name (e.g. "Claude Code") */
	readonly displayName: string;
	/** Agent's official website URL */
	readonly url: string;
	/** Agent's GitHub repository URL, if open source */
	readonly githubUrl?: string;

	/**
	 * Optional: checks whether this agent is installed on the current system.
	 *
	 * Returns a resolved promise — never rejects.
	 */
	check?(): Promise<AgentCheckResult>;
}
