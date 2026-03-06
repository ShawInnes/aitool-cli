import * as fs from 'node:fs';
import * as path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getAgentSkillsDir, getClaudeSkillsDir} from '../config/paths.js';
import {type SkillLinkResult} from './skillsInstall.js';

export type SkillsUpdateRepoResult = {
	repoName: string;
	pulled: boolean;
	hasSkillsDir: boolean;
	links: SkillLinkResult[];
	error?: string;
};

function linkMissingSkills(skillsDir: string): SkillLinkResult[] {
	const claudeSkillsDir = getClaudeSkillsDir();
	fs.mkdirSync(claudeSkillsDir, {recursive: true});

	const links: SkillLinkResult[] = [];
	for (const entry of fs.readdirSync(skillsDir)) {
		const target = path.join(claudeSkillsDir, entry);
		const source = path.join(skillsDir, entry);

		// Use lstatSync to detect broken symlinks; existsSync returns false for them
		let targetExists = false;
		try {
			fs.lstatSync(target);
			targetExists = true;
		} catch {}

		if (targetExists) {
			links.push({name: entry, status: 'skipped', reason: 'already exists'});
			continue;
		}

		try {
			fs.symlinkSync(source, target);
			links.push({name: entry, status: 'linked'});
		} catch (error) {
			links.push({
				name: entry,
				status: 'skipped',
				reason: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return links;
}

function printResult(result: SkillsUpdateRepoResult): void {
	if (result.error) {
		console.error(`  error: ${result.repoName} — ${result.error}`);
		return;
	}

	console.log(`  pulled: ${result.repoName}`);
	for (const link of result.links) {
		if (link.status === 'linked') {
			console.log(`    linked: ${link.name}`);
		} else {
			console.warn(`    skipped: ${link.name} (${link.reason})`);
		}
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
			error: `Failed to pull ${repoName}: ${reason}`,
		};
	}

	const skillsDir = path.join(cloneDir, 'skills');
	let skillsDirExists = false;
	try {
		fs.lstatSync(skillsDir);
		skillsDirExists = true;
	} catch {}

	if (!skillsDirExists) {
		return {repoName, pulled: true, hasSkillsDir: false, links: []};
	}

	const links = linkMissingSkills(skillsDir);
	return {repoName, pulled: true, hasSkillsDir: true, links};
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
