import * as fs from 'node:fs';
import * as path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getAgentSkillsDir, getClaudeSkillsDir} from '../config/paths.js';

export type SkillLinkResult = {
	name: string;
	status: 'linked' | 'skipped';
	reason?: string;
};

export type SkillsInstallResult = {
	repoUrl: string;
	repoName: string;
	cloneDir: string;
	cloned: boolean;
	hasSkillsDir: boolean;
	links: SkillLinkResult[];
	error?: string;
};

function repoNameFromUrl(url: string): string {
	// Strip trailing slashes and .git suffix, then take the last path segment.
	// Handles HTTPS (https://github.com/org/repo.git) and SSH (git@github.com:org/repo.git).
	// Using lastIndexOf of both '/' and ':' handles SSH colon separators;
	// when a port is present (ssh://host:2222/org/repo), lastSlash wins over the colon.
	const normalized = url.replace(/\/+$/, '').replace(/\.git$/, '');
	const lastSlash = normalized.lastIndexOf('/');
	const lastColon = normalized.lastIndexOf(':');
	const separatorIdx = Math.max(lastSlash, lastColon);
	return separatorIdx >= 0 ? normalized.slice(separatorIdx + 1) : normalized;
}

function emit(
	options: {silent?: boolean; json?: boolean},
	result: SkillsInstallResult,
	plainText: () => void,
) {
	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
	} else if (!options.silent) {
		plainText();
	}
}

export function runSkillsInstall(options: {
	repoUrl: string;
	silent?: boolean;
	json?: boolean;
}): SkillsInstallResult {
	const {repoUrl, silent, json} = options;
	const repoName = repoNameFromUrl(repoUrl);
	const agentSkillsDir = getAgentSkillsDir();
	const cloneDir = path.join(agentSkillsDir, repoName);

	const base: Omit<SkillsInstallResult, 'cloned' | 'hasSkillsDir' | 'links'> = {
		repoUrl,
		repoName,
		cloneDir,
	};

	if (!repoName) {
		const result: SkillsInstallResult = {
			...base,
			cloned: false,
			hasSkillsDir: false,
			links: [],
			error: `Cannot parse repo name from URL: ${repoUrl}`,
		};
		emit(options, result, () => {
			console.error(`Error: ${result.error}`);
		});
		return result;
	}

	if (fs.existsSync(cloneDir)) {
		const result: SkillsInstallResult = {
			...base,
			cloned: false,
			hasSkillsDir: false,
			links: [],
			error: `${repoName} is already installed at ${cloneDir}`,
		};
		emit(options, result, () => {
			console.error(`Error: ${result.error}`);
		});
		return result;
	}

	fs.mkdirSync(agentSkillsDir, {recursive: true});

	// Use spawnSync with an args array to avoid shell injection
	const gitStdio = (silent ?? json) ? 'pipe' : 'inherit';
	const cloneResult = spawnSync('git', ['clone', '--', repoUrl, cloneDir], {
		stdio: ['ignore', gitStdio, gitStdio],
	});

	if (cloneResult.status !== 0) {
		const result: SkillsInstallResult = {
			...base,
			cloned: false,
			hasSkillsDir: false,
			links: [],
			error: `Failed to clone ${repoUrl}`,
		};
		emit(options, result, () => {
			console.error(`Error: ${result.error}`);
		});
		return result;
	}

	const skillsDir = path.join(cloneDir, 'skills');
	if (!fs.existsSync(skillsDir)) {
		const result: SkillsInstallResult = {
			...base,
			cloned: true,
			hasSkillsDir: false,
			links: [],
		};
		emit(options, result, () => {
			console.log(
				`Cloned ${repoName} but no skills/ directory found — nothing to link.`,
			);
		});
		return result;
	}

	const claudeSkillsDir = getClaudeSkillsDir();
	fs.mkdirSync(claudeSkillsDir, {recursive: true});

	const entries = fs.readdirSync(skillsDir);
	const links: SkillLinkResult[] = [];

	for (const entry of entries) {
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

	const result: SkillsInstallResult = {
		...base,
		cloned: true,
		hasSkillsDir: true,
		links,
	};

	emit(options, result, () => {
		for (const link of links) {
			if (link.status === 'linked') {
				console.log(`  linked: ${link.name}`);
			} else {
				console.warn(`  skipped: ${link.name} (${link.reason})`);
			}
		}
	});

	return result;
}
