// tests/skillsUpdate_spec.ts
import {describe, expect, test, beforeEach, afterEach} from 'bun:test';
import {mkdtempSync, rmSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
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
		expect(results[0]!.error).toBe('Failed to pull my-repo');
	});

	test('reports errors for multiple repos and continues', () => {
		mkdirSync(join(tmpDir, '.agent-skills', 'repo-a'), {recursive: true});
		mkdirSync(join(tmpDir, '.agent-skills', 'repo-b'), {recursive: true});
		const results = runSkillsUpdate({silent: true});
		expect(results).toHaveLength(2);
		expect(results.every(r => r.pulled === false)).toBe(true);
	});
});
