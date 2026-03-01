// src/agents/openCode.ts
import {homedir} from 'node:os';
import {join} from 'node:path';
import {execSync as nodeExecSync} from 'node:child_process';
import {type Agent, type AgentCheckResult, type Executor} from './agent.js';

/**
 * Open Code (opencode-ai terminal coding agent) agent.
 *
 * Detection strategy:
 *  1. Run `opencode --version` and capture stdout.
 *     - If successful, parse the version string from the first line of output.
 *  2. If `opencode --version` fails, fall back to `which opencode`
 *     (or `where opencode` on Windows).
 *  3. If both commands fail, the agent is considered not installed.
 *
 * References:
 *  - Install: curl -fsSL https://opencode.ai/install | bash
 *             OR npm i -g opencode-ai@latest
 *             OR brew install opencode
 *  - Binary name: `opencode`
 *  - Repository: https://github.com/opencode-ai/opencode
 */
export class OpenCodeAgent implements Agent {
	readonly id = 'opencode';
	readonly displayName = 'Open Code';
	readonly url = 'https://opencode.ai';
	readonly githubUrl = 'https://github.com/opencode-ai/opencode';
	readonly installUrl = 'https://opencode.ai/docs/install';
	readonly installCommands = {
		mac: 'brew install opencode',
		linux: 'curl -fsSL https://opencode.ai/install | bash',
		windows: 'npm install -g opencode-ai@latest',
	};
	readonly templatePath = 'opencode.json';

	defaultConfigFilePath(): string {
		// ~/.config/opencode/opencode.json on all platforms
		return join(homedir(), '.config', 'opencode', 'opencode.json');
	}

	private readonly exec: Executor;

	constructor(exec: Executor = nodeExecSync as unknown as Executor) {
		this.exec = exec;
	}

	async check(): Promise<AgentCheckResult> {
		// Attempt 1: run `opencode --version`
		try {
			const output = this.exec('opencode --version', {
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
			process.platform === 'win32' ? 'where opencode' : 'which opencode';
		try {
			const path =
				this.exec(whichCmd, {stdio: 'pipe', encoding: 'utf8'})
					.split('\n')[0]
					?.trim() ?? '';
			return {installed: true, path};
		} catch {
			return {
				installed: false,
				error: 'binary "opencode" not found in PATH',
			};
		}
	}
}

export const openCode: Agent = new OpenCodeAgent();
