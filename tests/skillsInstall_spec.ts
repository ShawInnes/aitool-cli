// tests/skillsInstall_spec.ts
import {describe, expect, test, beforeEach, afterEach} from 'bun:test';
import {mkdtempSync, rmSync, mkdirSync, writeFileSync, lstatSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {runSkillsInstall} from '../src/commands/skillsInstall.js';

let tmpDir: string;
let origHome: string | undefined;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'aitool-skills-install-'));
	origHome = process.env['HOME'];
	process.env['HOME'] = tmpDir;
});

afterEach(() => {
	process.env['HOME'] = origHome;
	rmSync(tmpDir, {recursive: true, force: true});
});

function setupBareRepo(dir: string): string {
	const bareRepo = join(dir, 'bare-repo.git');
	mkdirSync(bareRepo);
	spawnSync('git', ['init', '--bare', bareRepo]);

	const workDir = join(dir, 'work-repo');
	spawnSync('git', ['clone', bareRepo, workDir]);
	spawnSync('git', ['config', 'user.email', 'test@test.com'], {cwd: workDir});
	spawnSync('git', ['config', 'user.name', 'Test'], {cwd: workDir});

	const skillsDir = join(workDir, 'skills');
	mkdirSync(join(skillsDir, 'my-skill'), {recursive: true});
	writeFileSync(join(skillsDir, 'my-skill', 'SKILL.md'), '---\nname: my-skill\n---\nhello');

	spawnSync('git', ['add', '.'], {cwd: workDir});
	spawnSync('git', ['commit', '-m', 'init'], {cwd: workDir});
	spawnSync('git', ['push', 'origin', 'HEAD'], {cwd: workDir});

	return bareRepo;
}

describe('runSkillsInstall — error cases', () => {
	test('returns error and empty agentLinks for empty URL', () => {
		const result = runSkillsInstall({repoUrl: '', silent: true});
		expect(result.error).toBeTruthy();
		expect(result.agentLinks).toEqual([]);
	});

	test('returns error and empty agentLinks when already installed', () => {
		const bareRepo = setupBareRepo(tmpDir);
		runSkillsInstall({repoUrl: bareRepo, silent: true});
		const result = runSkillsInstall({repoUrl: bareRepo, silent: true});
		expect(result.error).toContain('already installed');
		expect(result.agentLinks).toEqual([]);
	});
});

describe('runSkillsInstall — success path', () => {
	test('links skill to ~/.claude/skills/ and ~/.agents/skills/', () => {
		const bareRepo = setupBareRepo(tmpDir);
		const result = runSkillsInstall({repoUrl: bareRepo, silent: true});

		expect(result.cloned).toBe(true);
		expect(result.hasSkillsDir).toBe(true);

		expect(result.links).toHaveLength(1);
		expect(result.links[0]).toMatchObject({name: 'my-skill', status: 'linked'});
		expect(lstatSync(join(tmpDir, '.claude', 'skills', 'my-skill')).isSymbolicLink()).toBe(true);

		expect(result.agentLinks).toHaveLength(1);
		expect(result.agentLinks[0]).toMatchObject({name: 'my-skill', status: 'linked'});
		expect(lstatSync(join(tmpDir, '.agents', 'skills', 'my-skill')).isSymbolicLink()).toBe(true);
	});
});
