// tests/agentConfigure_spec.ts
import {describe, expect, test, beforeEach, afterEach} from 'bun:test';
import {
	mkdtempSync,
	rmSync,
	writeFileSync,
	readFileSync,
	copyFileSync,
	existsSync,
} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import * as jsondiffpatch from 'jsondiffpatch';

const thisDir = dirname(fileURLToPath(import.meta.url));

import {
	parseDelta,
	countChanges,
	applyPatch,
	type DiffNode,
} from '../src/commands/agentConfigure.js';

// ---------------------------------------------------------------------------
// parseDelta
// ---------------------------------------------------------------------------

describe('parseDelta', () => {
	test('returns undefined for null input', () => {
		expect(parseDelta(null)).toBeUndefined();
	});

	test('returns undefined for undefined input', () => {
		expect(parseDelta(undefined)).toBeUndefined();
	});

	test('parses [newValue] as added', () => {
		const node = parseDelta(['hello']);
		expect(node).toEqual({kind: 'added', value: 'hello'});
	});

	test('parses [oldValue, newValue] as changed', () => {
		const node = parseDelta([1, 2]);
		expect(node).toEqual({kind: 'changed', templateValue: 1, localValue: 2});
	});

	test('parses [oldValue, 0, 0] as removed', () => {
		const node = parseDelta(['gone', 0, 0]);
		expect(node).toEqual({kind: 'removed', value: 'gone'});
	});

	test('treats unknown array length as changed (fallback)', () => {
		// 4-element array falls through to fallback branch
		const node = parseDelta([1, 2, 3, 4]);
		expect(node).toEqual({kind: 'changed', templateValue: 1, localValue: 2});
	});

	test('parses a plain object delta recursively', () => {
		const delta = {
			foo: ['bar'], // added
			baz: [1, 2], // changed
			qux: ['old', 0, 0], // removed
		};
		const node = parseDelta(delta);
		expect(node).toEqual({
			kind: 'object',
			children: {
				foo: {kind: 'added', value: 'bar'},
				baz: {kind: 'changed', templateValue: 1, localValue: 2},
				qux: {kind: 'removed', value: 'old'},
			},
		});
	});

	test('returns undefined for object with no parseable children', () => {
		const node = parseDelta({});
		expect(node).toBeUndefined();
	});

	test('parses array diff node (_t === "a")', () => {
		const delta = {
			_t: 'a',
			0: ['added-item'],
			1: ['removed-item', 0, 0],
		};
		const node = parseDelta(delta);
		expect(node?.kind).toBe('array');
		if (node?.kind === 'array') {
			expect(node.items).toHaveLength(2);
			expect(node.items).toContainEqual({kind: 'added', value: 'added-item'});
			expect(node.items).toContainEqual({
				kind: 'removed',
				value: 'removed-item',
			});
		}
	});

	test('skips _t key when parsing array diff node', () => {
		// No real items — all children skipped → empty items array
		const delta = {_t: 'a'};
		const node = parseDelta(delta);
		expect(node).toEqual({kind: 'array', items: []});
	});

	test('handles nested object delta', () => {
		const delta = {
			outer: {
				inner: ['new-value'],
			},
		};
		const node = parseDelta(delta);
		expect(node).toEqual({
			kind: 'object',
			children: {
				outer: {
					kind: 'object',
					children: {
						inner: {kind: 'added', value: 'new-value'},
					},
				},
			},
		});
	});
});

// ---------------------------------------------------------------------------
// countChanges
// ---------------------------------------------------------------------------

describe('countChanges', () => {
	test('counts an added leaf', () => {
		const node: DiffNode = {kind: 'added', value: 'x'};
		expect(countChanges(node)).toEqual({added: 1, changed: 0, removed: 0});
	});

	test('counts a removed leaf', () => {
		const node: DiffNode = {kind: 'removed', value: 'x'};
		expect(countChanges(node)).toEqual({added: 0, changed: 0, removed: 1});
	});

	test('counts a changed leaf', () => {
		const node: DiffNode = {kind: 'changed', templateValue: 1, localValue: 2};
		expect(countChanges(node)).toEqual({added: 0, changed: 1, removed: 0});
	});

	test('aggregates counts across an object node', () => {
		const node: DiffNode = {
			kind: 'object',
			children: {
				a: {kind: 'added', value: 1},
				b: {kind: 'removed', value: 2},
				c: {kind: 'changed', templateValue: 3, localValue: 4},
			},
		};
		expect(countChanges(node)).toEqual({added: 1, changed: 1, removed: 1});
	});

	test('aggregates counts across an array node', () => {
		const node: DiffNode = {
			kind: 'array',
			items: [
				{kind: 'added', value: 'a'},
				{kind: 'added', value: 'b'},
				{kind: 'removed', value: 'c'},
			],
		};
		expect(countChanges(node)).toEqual({added: 2, changed: 0, removed: 1});
	});

	test('sums counts across nested object nodes', () => {
		const node: DiffNode = {
			kind: 'object',
			children: {
				x: {
					kind: 'object',
					children: {
						y: {kind: 'added', value: 1},
						z: {kind: 'changed', templateValue: 'a', localValue: 'b'},
					},
				},
				w: {kind: 'removed', value: 99},
			},
		};
		expect(countChanges(node)).toEqual({added: 1, changed: 1, removed: 1});
	});

	test('returns zeros for an empty object node', () => {
		const node: DiffNode = {kind: 'object', children: {}};
		expect(countChanges(node)).toEqual({added: 0, changed: 0, removed: 0});
	});

	test('returns zeros for an empty array node', () => {
		const node: DiffNode = {kind: 'array', items: []};
		expect(countChanges(node)).toEqual({added: 0, changed: 0, removed: 0});
	});
});

// ---------------------------------------------------------------------------
// applyPatch — uses a real temp file on disk
//
// applyPatch(localPath, template) backs up the local file to <path>.bak and
// then writes the full template object as the new config.
// ---------------------------------------------------------------------------

describe('applyPatch', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'aitool-test-'));
	});

	afterEach(() => {
		rmSync(tmpDir, {recursive: true, force: true});
	});

	function writeLocal(name: string, data: unknown): string {
		const p = join(tmpDir, name);
		writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
		return p;
	}

	function readLocal(p: string): unknown {
		return JSON.parse(readFileSync(p, 'utf8'));
	}

	test('writes the template as the new config', () => {
		const local = {old: true};
		const template = {new: true, extra: 42};
		const localPath = writeLocal('local.json', local);
		applyPatch(localPath, template);
		expect(readLocal(localPath)).toEqual(template);
	});

	test('creates a .bak file containing the original local config', () => {
		const local = {original: 'value'};
		const template = {replacement: 'value'};
		const localPath = writeLocal('local.json', local);
		applyPatch(localPath, template);
		expect(existsSync(`${localPath}.bak`)).toBe(true);
		expect(readLocal(`${localPath}.bak`)).toEqual(local);
	});

	test('.bak preserves the exact original bytes', () => {
		const original = '{"x":1}\n';
		const localPath = join(tmpDir, 'local.json');
		writeFileSync(localPath, original, 'utf8');
		applyPatch(localPath, {x: 2});
		expect(readFileSync(`${localPath}.bak`, 'utf8')).toBe(original);
	});

	test('writes formatted JSON with a trailing newline', () => {
		const localPath = writeLocal('local.json', {x: 1});
		applyPatch(localPath, {a: 1, b: 2});
		const raw = readFileSync(localPath, 'utf8');
		expect(raw.endsWith('\n')).toBe(true);
		expect(raw.split('\n').length).toBeGreaterThan(1);
	});

	test('overwrites local with deeply nested template', () => {
		const local = {top: {nested: 'old'}};
		const template = {top: {nested: 'new', added: true}, extra: [1, 2]};
		const localPath = writeLocal('local.json', local);
		applyPatch(localPath, template);
		expect(readLocal(localPath)).toEqual(template);
	});
});

// ---------------------------------------------------------------------------
// diff → parseDelta round-trip (integration)
// ---------------------------------------------------------------------------

describe('diff → parseDelta round-trip', () => {
	const instance = jsondiffpatch.create({});

	test('produces no diff for identical objects', () => {
		const obj = {a: 1, b: 'hello'};
		const delta = instance.diff(obj, obj);
		expect(delta).toBeUndefined();
	});

	test('correctly classifies added, changed, and removed keys', () => {
		// diff(template, local):
		//   • key in template but not local → delta [val, 0, 0] → code: "removed"
		//   • key in local but not template → delta [val]       → code: "added"
		//   • key in both but different     → delta [old, new]  → code: "changed"
		const template = {keep: 'same', change: 'old', tmplOnly: 'template-only'};
		const local = {keep: 'same', change: 'new', localOnly: 'local-only'};

		const delta = instance.diff(template, local);
		const node = parseDelta(delta);

		expect(node?.kind).toBe('object');
		if (node?.kind !== 'object') return;

		// "change" differs → changed (template=old, local=new)
		expect(node.children['change']).toEqual({
			kind: 'changed',
			templateValue: 'old',
			localValue: 'new',
		});
		// "tmplOnly" in template but absent in local → [val, 0, 0] → removed
		expect(node.children['tmplOnly']).toEqual({
			kind: 'removed',
			value: 'template-only',
		});
		// "localOnly" in local but absent in template → [val] → added
		expect(node.children['localOnly']).toEqual({
			kind: 'added',
			value: 'local-only',
		});
		// "keep" is identical → absent from delta
		expect(node.children['keep']).toBeUndefined();
	});

	test('countChanges on a real delta matches expected totals', () => {
		// template: {a:1, b:2, c:3}
		// local:    {a:10, b:2, d:4}
		// diff(template, local):
		//   a changed (1→10), c removed ([3,0,0]), d added ([4])
		const template = {a: 1, b: 2, c: 3};
		const local = {a: 10, b: 2, d: 4};

		const delta = instance.diff(template, local);
		const node = parseDelta(delta);
		expect(node?.kind).toBe('object');

		const total = Object.values(
			(node as Extract<DiffNode, {kind: 'object'}>).children,
		).reduce(
			(acc, child) => {
				const c = countChanges(child);
				return {
					added: acc.added + c.added,
					changed: acc.changed + c.changed,
					removed: acc.removed + c.removed,
				};
			},
			{added: 0, changed: 0, removed: 0},
		);

		expect(total.changed).toBe(1); // a: 1 → 10
		expect(total.added).toBe(1); // d: present in local, not template
		expect(total.removed).toBe(1); // c: present in template, not local
	});
});

// ---------------------------------------------------------------------------
// Fixture-based tests: claude-template.json vs claude-target.json
//
// template has two top-level keys that target lacks:
//   • companyAnnouncements  — an array
//   • env                   — an object with 8 env-var entries
// All other keys ($schema, effortLevel, enabledPlugins, permissions, model,
// attribution) are identical.
// ---------------------------------------------------------------------------

describe('claude-template.json vs claude-target.json', () => {
	const templatePath = join(thisDir, 'agents', 'claude-template.json');
	const targetPath = join(thisDir, 'agents', 'claude-target.json');

	const template = JSON.parse(readFileSync(templatePath, 'utf8')) as Record<
		string,
		unknown
	>;
	const target = JSON.parse(readFileSync(targetPath, 'utf8')) as Record<
		string,
		unknown
	>;

	const instance = jsondiffpatch.create({});

	// diff(template, target): describes how target differs from template
	const delta = instance.diff(template, target);

	test('diff is non-null (files differ)', () => {
		expect(delta).toBeDefined();
	});

	test('diff only touches companyAnnouncements and env', () => {
		const node = parseDelta(delta);
		expect(node?.kind).toBe('object');
		if (node?.kind !== 'object') return;

		const changedKeys = Object.keys(node.children).sort();
		expect(changedKeys).toEqual(['companyAnnouncements', 'env']);
	});

	test('companyAnnouncements is classified as removed (present in template, absent in target)', () => {
		const node = parseDelta(delta);
		if (node?.kind !== 'object') return;

		const entry = node.children['companyAnnouncements'];
		expect(entry?.kind).toBe('removed');
		if (entry?.kind === 'removed') {
			expect(Array.isArray(entry.value)).toBe(true);
		}
	});

	test('env is classified as removed (present in template, absent in target)', () => {
		const node = parseDelta(delta);
		if (node?.kind !== 'object') return;

		const entry = node.children['env'];
		expect(entry?.kind).toBe('removed');
		if (entry?.kind === 'removed') {
			expect(entry.value).toEqual(template['env']);
		}
	});

	test('countChanges reports 2 removed, 0 added, 0 changed', () => {
		const node = parseDelta(delta);
		if (node?.kind !== 'object') return;

		const counts = Object.values(node.children).reduce(
			(acc, child) => {
				const c = countChanges(child);
				return {
					added: acc.added + c.added,
					changed: acc.changed + c.changed,
					removed: acc.removed + c.removed,
				};
			},
			{added: 0, changed: 0, removed: 0},
		);

		expect(counts).toEqual({added: 0, changed: 0, removed: 2});
	});

	describe('applyPatch: write template over target', () => {
		let tmpDir: string;
		let workingCopy: string;

		beforeEach(() => {
			tmpDir = mkdtempSync(join(tmpdir(), 'aitool-claude-test-'));
			workingCopy = join(tmpDir, 'claude-target.json');
			copyFileSync(targetPath, workingCopy);
		});

		afterEach(() => {
			rmSync(tmpDir, {recursive: true, force: true});
		});

		test('result equals the template', () => {
			applyPatch(workingCopy, template);
			expect(JSON.parse(readFileSync(workingCopy, 'utf8'))).toEqual(template);
		});

		test('result contains companyAnnouncements from template', () => {
			applyPatch(workingCopy, template);
			const result = JSON.parse(readFileSync(workingCopy, 'utf8')) as Record<
				string,
				unknown
			>;
			expect(result['companyAnnouncements']).toEqual(
				template['companyAnnouncements'],
			);
		});

		test('result contains env block from template', () => {
			applyPatch(workingCopy, template);
			const result = JSON.parse(readFileSync(workingCopy, 'utf8')) as Record<
				string,
				unknown
			>;
			expect(result['env']).toEqual(template['env']);
		});

		test('creates a .bak of the original target', () => {
			applyPatch(workingCopy, template);
			expect(existsSync(`${workingCopy}.bak`)).toBe(true);
			expect(JSON.parse(readFileSync(`${workingCopy}.bak`, 'utf8'))).toEqual(
				target,
			);
		});

		test('result is formatted JSON with a trailing newline', () => {
			applyPatch(workingCopy, template);
			const raw = readFileSync(workingCopy, 'utf8');
			expect(raw.endsWith('\n')).toBe(true);
			expect(raw.split('\n').length).toBeGreaterThan(1);
		});
	});
});
