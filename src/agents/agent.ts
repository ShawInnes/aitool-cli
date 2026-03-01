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
	/** URL for the agent's installation instructions / download page */
	readonly installUrl?: string;

	/**
	 * Optional: returns the default local config file path for this agent on the
	 * current platform (e.g. `~/.claude/settings.json`). Used by
	 * `agent configure` to locate the file to diff against the template.
	 *
	 * May return `undefined` when the agent has no known local config location.
	 */
	defaultConfigFilePath?(): string | undefined;

	/**
	 * Optional path to a configuration template file, relative to `src/templates/`
	 * (e.g. `"claudeCode.json"`). Takes precedence over `templateUrl` when both
	 * are supplied.
	 */
	readonly templatePath?: string;

	/**
	 * Optional URL (or absolute file path) to a configuration template.
	 * Used when the template is hosted externally or outside `src/templates/`.
	 */
	readonly templateUrl?: string;

	/**
	 * Optional: checks whether this agent is installed on the current system.
	 *
	 * Returns a resolved promise — never rejects.
	 */
	check?(): Promise<AgentCheckResult>;
}
