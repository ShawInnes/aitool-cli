// src/agents/crush.ts
import {homedir} from 'node:os';
import {join} from 'node:path';
import {execSync as nodeExecSync} from 'node:child_process';
import {type Agent, type AgentCheckResult, type Executor} from './agent.js';

/**
 * Crush (Charmbracelet agentic terminal coding agent) agent.
 *
 * Detection strategy:
 *  1. Run `crush --version` and capture stdout.
 *     - If successful, parse the version string from the first line of output.
 *  2. If `crush --version` fails, fall back to `which crush`
 *     (or `where crush` on Windows).
 *  3. If both commands fail, the agent is considered not installed.
 *
 * References:
 *  - Install: brew install charmbracelet/tap/crush
 *             OR go install github.com/charmbracelet/crush@latest
 *  - Binary name: `crush`
 *  - Repository: https://github.com/charmbracelet/crush
 */
export class CrushAgent implements Agent {
	readonly id = 'crush';
	readonly displayName = 'Crush';
	readonly url = 'https://charm.land';
	readonly githubUrl = 'https://github.com/charmbracelet/crush';
	readonly templatePath = 'crush.json';

	defaultConfigFilePath(): string {
		// Windows: %LOCALAPPDATA%\crush\crush.json
		// macOS / Linux: ~/.config/crush/crush.json
		if (process.platform === 'win32') {
			const localAppData =
				process.env['LOCALAPPDATA'] ?? join(homedir(), 'AppData', 'Local');
			return join(localAppData, 'crush', 'crush.json');
		}

		return join(homedir(), '.config', 'crush', 'crush.json');
	}

	private readonly exec: Executor;

	constructor(exec: Executor = nodeExecSync as unknown as Executor) {
		this.exec = exec;
	}

	async check(): Promise<AgentCheckResult> {
		// Attempt 1: run `crush --version`
		try {
			const output = this.exec('crush --version', {
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
			process.platform === 'win32' ? 'where crush' : 'which crush';
		try {
			const path =
				this.exec(whichCmd, {stdio: 'pipe', encoding: 'utf8'})
					.split('\n')[0]
					?.trim() ?? '';
			return {installed: true, path};
		} catch {
			return {
				installed: false,
				error: 'binary "crush" not found in PATH',
			};
		}
	}
}

export const crush: Agent = new CrushAgent();
