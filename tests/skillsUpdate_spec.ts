// tests/skillsUpdate_spec.ts
import {describe, expect, test, beforeEach, afterEach} from 'bun:test';
import {mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {runSkillsUpdate} from '../src/commands/skillsUpdate.js';

let tmpDir: string;
let origHome: string | undefined;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'aitool-skills-update-'));
	origHome = process.env['HOME'];
	process.env['HOME'] = tmpDir;
});

afterEach(() => {
	process.env['HOME'] = origHome;
	rmSync(tmpDir, {recursive: true, force: true});
});

describe('runSkillsUpdate — no repos', () => {
	test('returns [] when ~/.agent-skills/ does not exist', () => {
		expect(runSkillsUpdate({silent: true})).toEqual([]);
	});

	test('returns [] when ~/.agent-skills/ is empty', () => {
		mkdirSync(join(tmpDir, '.agent-skills'));
		expect(runSkillsUpdate({silent: true})).toEqual([]);
	});
});

describe('runSkillsUpdate — pull fails on non-git dir', () => {
	test('returns error result for each non-git repo dir', () => {
		mkdirSync(join(tmpDir, '.agent-skills', 'my-repo'), {recursive: true});
		const results = runSkillsUpdate({silent: true});
		expect(results).toHaveLength(1);
		expect(results[0]!.repoName).toBe('my-repo');
		expect(results[0]!.pulled).toBe(false);
		expect(results[0]!.error).toContain('Failed to pull my-repo');
	});

	test('reports errors for multiple repos and continues', () => {
		mkdirSync(join(tmpDir, '.agent-skills', 'repo-a'), {recursive: true});
		mkdirSync(join(tmpDir, '.agent-skills', 'repo-b'), {recursive: true});
		const results = runSkillsUpdate({silent: true});
		expect(results).toHaveLength(2);
		expect(results.every(r => r.pulled === false)).toBe(true);
	});
});

function setupGitRepo(tmpDir: string): string {
	const bareRepo = join(tmpDir, 'bare-repo.git');
	mkdirSync(bareRepo);
	spawnSync('git', ['init', '--bare', bareRepo]);

	const cloneDir = join(tmpDir, '.agent-skills', 'test-repo');
	spawnSync('git', ['clone', bareRepo, cloneDir]);

	spawnSync('git', ['config', 'user.email', 'test@test.com'], {cwd: cloneDir});
	spawnSync('git', ['config', 'user.name', 'Test'], {cwd: cloneDir});

	const skillsDir = join(cloneDir, 'skills');
	mkdirSync(skillsDir);
	writeFileSync(join(skillsDir, 'my-skill.md'), 'hello');

	spawnSync('git', ['add', '.'], {cwd: cloneDir});
	spawnSync('git', ['commit', '-m', 'init'], {cwd: cloneDir});
	spawnSync('git', ['push', 'origin', 'HEAD'], {cwd: cloneDir});

	return cloneDir;
}

describe('runSkillsUpdate — success path', () => {
	test('links new skills from a valid git repo', () => {
		setupGitRepo(tmpDir);
		const results = runSkillsUpdate({silent: true});
		expect(results).toHaveLength(1);
		expect(results[0]!.pulled).toBe(true);
		expect(results[0]!.hasSkillsDir).toBe(true);
		expect(results[0]!.links).toHaveLength(1);
		expect(results[0]!.links[0]).toMatchObject({name: 'my-skill.md', status: 'linked'});
	});

	test('skips already-linked skills', () => {
		const cloneDir = setupGitRepo(tmpDir);
		const claudeSkillsDir = join(tmpDir, '.claude', 'skills');
		mkdirSync(claudeSkillsDir, {recursive: true});
		symlinkSync(
			join(cloneDir, 'skills', 'my-skill.md'),
			join(claudeSkillsDir, 'my-skill.md'),
		);
		const results = runSkillsUpdate({silent: true});
		expect(results[0]!.links[0]).toMatchObject({name: 'my-skill.md', status: 'skipped'});
	});
});
