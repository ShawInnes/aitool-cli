import * as fs from 'node:fs';
import * as path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
	getAgentSkillsDir,
	getClaudeSkillsDir,
	getAgentsSkillsDir,
} from '../config/paths.js';
import {type SkillLinkResult, linkSkillEntries} from './skillsInstall.js';

export type SkillsUpdateRepoResult = {
	repoName: string;
	pulled: boolean;
	hasSkillsDir: boolean;
	links: SkillLinkResult[];
	agentLinks: SkillLinkResult[];
	error?: string;
};

function printResult(result: SkillsUpdateRepoResult): void {
	if (result.error) {
		console.error(`  error: ${result.repoName} — ${result.error}`);
		return;
	}

	console.log(`  pulled: ${result.repoName}`);
	if (result.hasSkillsDir) {
		const printLinks = (label: string, entries: SkillLinkResult[]) => {
			const newLinks = entries.filter(l => l.status === 'linked');
			if (newLinks.length === 0) return;
			console.log(`  ${label}`);
			for (const link of newLinks) {
				console.log(`    linked: ${link.name}`);
			}
		};

		printLinks('~/.claude/skills/', result.links);
		printLinks('~/.agents/skills/', result.agentLinks);
	}
}

function updateRepo(
	repoName: string,
	cloneDir: string,
	gitStdio: 'pipe' | 'inherit',
): SkillsUpdateRepoResult {
	const pullResult = spawnSync('git', ['pull'], {
		cwd: cloneDir,
		stdio: ['ignore', gitStdio, gitStdio],
	});

	if (pullResult.status !== 0) {
		const reason =
			pullResult.error?.message ??
			`exited with status ${String(pullResult.status)}`;
		return {
			repoName,
			pulled: false,
			hasSkillsDir: false,
			links: [],
			agentLinks: [],
			error: `Failed to pull ${repoName}: ${reason}`,
		};
	}

	const skillsDir = path.join(cloneDir, 'skills');
	let skillsDirExists = false;
	try {
		skillsDirExists = fs.lstatSync(skillsDir).isDirectory();
	} catch {}

	if (!skillsDirExists) {
		return {
			repoName,
			pulled: true,
			hasSkillsDir: false,
			links: [],
			agentLinks: [],
		};
	}

	const links = linkSkillEntries(skillsDir, getClaudeSkillsDir());
	const agentLinks = linkSkillEntries(skillsDir, getAgentsSkillsDir());
	return {repoName, pulled: true, hasSkillsDir: true, links, agentLinks};
}

export function runSkillsUpdate(options: {
	silent?: boolean;
	json?: boolean;
}): SkillsUpdateRepoResult[] {
	const {silent, json} = options;
	const agentSkillsDir = getAgentSkillsDir();

	let agentSkillsDirExists = false;
	try {
		fs.lstatSync(agentSkillsDir);
		agentSkillsDirExists = true;
	} catch {}

	if (!agentSkillsDirExists) {
		return [];
	}

	const repoDirs = fs
		.readdirSync(agentSkillsDir, {withFileTypes: true})
		.filter(d => d.isDirectory())
		.map(d => d.name);

	if (repoDirs.length === 0) {
		return [];
	}

	const gitStdio = (silent ?? false) || (json ?? false) ? 'pipe' : 'inherit';
	const results: SkillsUpdateRepoResult[] = [];

	for (const repoName of repoDirs) {
		const cloneDir = path.join(agentSkillsDir, repoName);
		const result = updateRepo(repoName, cloneDir, gitStdio);
		results.push(result);

		if (!silent && !json) {
			printResult(result);
		}
	}

	if (json) {
		console.log(JSON.stringify(results, null, 2));
	}

	return results;
}
