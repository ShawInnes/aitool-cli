// tests/unifiedDiff_spec.ts
import {describe, expect, test} from 'bun:test';
import {unifiedDiff, colorizeDiff} from '../src/commands/unifiedDiff.js';

describe('unifiedDiff', () => {
	test('returns empty string for identical inputs', () => {
		const text = '{"a": 1}\n';
		expect(unifiedDiff(text, text, 'a/f', 'b/f')).toBe('');
	});

	test('includes --- and +++ headers', () => {
		const from = 'a\n';
		const to = 'b\n';
		const result = unifiedDiff(from, to, 'a/file', 'b/file');
		expect(result).toContain('--- a/file');
		expect(result).toContain('+++ b/file');
	});

	test('marks removed lines with -', () => {
		const result = unifiedDiff('hello\n', 'world\n', 'a', 'b');
		expect(result).toContain('-hello');
		expect(result).toContain('+world');
	});

	test('marks added lines with +', () => {
		const result = unifiedDiff('', 'new line\n', 'a', 'b');
		expect(result).toContain('+new line');
	});

	test('includes unchanged context lines with a leading space', () => {
		const from = 'ctx\nold\nctx\n';
		const to = 'ctx\nnew\nctx\n';
		const result = unifiedDiff(from, to, 'a', 'b');
		const lines = result.split('\n');
		const contextLines = lines.filter(l => l.startsWith(' ctx'));
		expect(contextLines.length).toBeGreaterThan(0);
	});

	test('produces a @@ hunk header', () => {
		const from = 'a\nb\nc\n';
		const to = 'a\nx\nc\n';
		const result = unifiedDiff(from, to, 'a', 'b');
		expect(result).toMatch(/^@@\s+-\d+,\d+\s+\+\d+,\d+\s+@@/m);
	});

	test('omits context lines beyond the context window', () => {
		// 10 unchanged lines then a change — with context=3, lines 1-7 should not appear
		const shared = Array.from({length: 10}, (_, i) => `line${i + 1}`).join(
			'\n',
		);
		const from = shared + '\nold\n';
		const to = shared + '\nnew\n';
		const result = unifiedDiff(from, to, 'a', 'b', 3);
		// line7 is just outside the context window and must not appear
		expect(result).not.toContain(' line7\n');
		expect(result).toContain(' line8\n');
		expect(result).toContain(' line9\n');
		expect(result).toContain(' line10\n');
	});

	test('merges nearby hunks into one', () => {
		// Two changes 2 lines apart — with context=3 they overlap into a single hunk
		const from = 'a\nb\nc\nd\ne\nf\ng\n';
		const to = 'A\nb\nc\nd\ne\nf\nG\n';
		const result = unifiedDiff(from, to, 'a', 'b', 3);
		const hunkHeaders = result.match(/^@@/gm);
		expect(hunkHeaders).toHaveLength(1);
	});

	test('produces two separate hunks when changes are far apart', () => {
		const from = Array.from({length: 20}, (_, i) => `line${i + 1}`).join('\n');
		const toLines = from.split('\n');
		toLines[0] = 'CHANGED';
		toLines[19] = 'CHANGED';
		const to = toLines.join('\n');
		const result = unifiedDiff(from, to, 'a', 'b', 3);
		const hunkHeaders = result.match(/^@@/gm);
		expect(hunkHeaders).toHaveLength(2);
	});
});

describe('colorizeDiff', () => {
	test('wraps --- header lines in bold+dim ANSI codes', () => {
		const result = colorizeDiff('--- a/file');
		expect(result).toContain('\x1b[1m');
		expect(result).toContain('\x1b[2m');
		expect(result).toContain('--- a/file');
		expect(result).toContain('\x1b[0m');
	});

	test('wraps +++ header lines in bold+dim ANSI codes', () => {
		const result = colorizeDiff('+++ b/file');
		expect(result).toContain('\x1b[1m');
		expect(result).toContain('+++ b/file');
	});

	test('wraps @@ hunk headers in cyan', () => {
		const result = colorizeDiff('@@ -1,3 +1,3 @@');
		expect(result).toContain('\x1b[36m');
		expect(result).toContain('@@ -1,3 +1,3 @@');
	});

	test('wraps - lines in red', () => {
		const result = colorizeDiff('-removed line');
		expect(result).toContain('\x1b[31m');
		expect(result).toContain('-removed line');
	});

	test('wraps + lines in green', () => {
		const result = colorizeDiff('+added line');
		expect(result).toContain('\x1b[32m');
		expect(result).toContain('+added line');
	});

	test('leaves context lines unstyled', () => {
		const line = ' unchanged line';
		expect(colorizeDiff(line)).toBe(line);
	});

	test('does not apply red/green to --- and +++ headers', () => {
		// --- and +++ are headers, not del/add lines — they get bold+dim, not red/green
		expect(colorizeDiff('--- a/f')).not.toContain('\x1b[31m');
		expect(colorizeDiff('+++ b/f')).not.toContain('\x1b[32m');
	});
});
