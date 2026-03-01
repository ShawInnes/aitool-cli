// src/agents/continue.ts
import {execSync as nodeExecSync} from 'node:child_process';
import {type Agent, type AgentCheckResult, type Executor} from './agent.js';

/**
 * Continue (open source AI coding agent for VS Code and JetBrains) agent.
 *
 * Detection strategy:
 *  1. Run `cn --version` and capture stdout.
 *     - If successful, parse the version string from the first line of output.
 *  2. If `cn --version` fails, fall back to `which cn`
 *     (or `where cn` on Windows).
 *  3. If both commands fail, the agent is considered not installed.
 *
 * References:
 *  - Install: curl -fsSL https://raw.githubusercontent.com/continuedev/continue/main/extensions/cli/scripts/install.sh | bash
 *             OR npm i -g @continuedev/cli
 *  - Binary name: `cn`
 *  - Repository: https://github.com/continuedev/continue
 */
export class ContinueAgent implements Agent {
	readonly id = 'continue';
	readonly displayName = 'Continue';
	readonly url = 'https://continue.dev';
	readonly githubUrl = 'https://github.com/continuedev/continue';
	readonly installUrl = 'https://docs.continue.dev/cli/quickstart';
	readonly installCommands = {
		mac: 'curl -fsSL https://raw.githubusercontent.com/continuedev/continue/main/extensions/cli/scripts/install.sh | bash',
		linux:
			'curl -fsSL https://raw.githubusercontent.com/continuedev/continue/main/extensions/cli/scripts/install.sh | bash',
		windows:
			'irm https://raw.githubusercontent.com/continuedev/continue/main/extensions/cli/scripts/install.ps1 | iex',
	};

	private readonly exec: Executor;

	constructor(exec: Executor = nodeExecSync as unknown as Executor) {
		this.exec = exec;
	}

	async check(): Promise<AgentCheckResult> {
		// Attempt 1: run `cn --version`
		try {
			const output = this.exec('cn --version', {
				stdio: 'pipe',
				encoding: 'utf8',
			}).trim();
			const version = output.split('\n')[0]?.trim();
			return {installed: true, version};
		} catch {
			// Binary not found or returned non-zero — fall through
		}

		// Attempt 2: locate binary with which/where
		const whichCmd = process.platform === 'win32' ? 'where cn' : 'which cn';
		try {
			const path =
				this.exec(whichCmd, {stdio: 'pipe', encoding: 'utf8'})
					.split('\n')[0]
					?.trim() ?? '';
			return {installed: true, path};
		} catch {
			return {
				installed: false,
				error: 'binary "cn" not found in PATH',
			};
		}
	}
}

export const continueAgent: Agent = new ContinueAgent();
