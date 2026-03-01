// src/agents/claudeCode.ts
import {execSync as nodeExecSync} from 'node:child_process';
import {type Agent, type AgentCheckResult, type Executor} from './agent.js';

/**
 * Claude Code (Anthropic's AI coding CLI) agent.
 *
 * Detection strategy:
 *  1. Run `claude --version` and capture stdout.
 *     - If successful, parse the version string from the first line of output.
 *  2. If `claude --version` fails (binary absent or permission error),
 *     fall back to `which claude` (or `where claude` on Windows) to
 *     locate the binary path without invoking it.
 *  3. If both commands fail, the agent is considered not installed.
 *
 * References:
 *  - Install: npm install -g @anthropic-ai/claude-code
 *             OR curl -fsSL https://claude.ai/install.sh | bash
 *  - Binary name: `claude`
 *  - Typical paths: ~/.local/bin/claude, ~/.claude/bin/claude
 */
export class ClaudeCodeAgent implements Agent {
	readonly id = 'claude-code';
	readonly displayName = 'Claude Code';

	private readonly exec: Executor;

	constructor(exec: Executor = nodeExecSync as unknown as Executor) {
		this.exec = exec;
	}

	async check(): Promise<AgentCheckResult> {
		// Attempt 1: run `claude --version`
		try {
			const output = this.exec('claude --version', {
				stdio: 'pipe',
				encoding: 'utf8',
			}).trim();
			const version = output.split('\n')[0]?.trim();
			return {installed: true, version};
		} catch {
			// Binary not found or returned non-zero — fall through
		}

		// Attempt 2: locate binary with which/where
		const whichCmd =
			process.platform === 'win32' ? 'where claude' : 'which claude';
		try {
			const path =
				this.exec(whichCmd, {stdio: 'pipe', encoding: 'utf8'})
					.split('\n')[0]
					?.trim() ?? '';
			return {installed: true, path};
		} catch {
			return {installed: false, error: 'binary "claude" not found in PATH'};
		}
	}
}

export const claudeCode: Agent = new ClaudeCodeAgent();
