// src/commands/unifiedDiff.ts

type Edit = {kind: 'eq' | 'del' | 'add'; line: string};
type AnnotatedEdit = Edit & {
	/** 1-based line number in the "from" file (valid for eq and del). */
	fl: number;
	/** 1-based line number in the "to" file (valid for eq and add). */
	tl: number;
};

/** Compute the shortest edit script between two line arrays using LCS backtracking. */
function computeEdits(from: string[], to: string[]): Edit[] {
	const m = from.length;
	const n = to.length;

	// Build LCS table
	const dp = Array.from({length: m + 1}, () => new Uint32Array(n + 1));
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			dp[i][j] =
				from[i - 1] === to[j - 1]
					? dp[i - 1][j - 1] + 1
					: Math.max(dp[i - 1][j], dp[i][j - 1]);
		}
	}

	// Backtrack to produce the edit list
	const result: Edit[] = [];
	let i = m;
	let j = n;
	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && from[i - 1] === to[j - 1]) {
			result.unshift({kind: 'eq', line: from[i - 1]});
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			result.unshift({kind: 'add', line: to[j - 1]});
			j--;
		} else {
			result.unshift({kind: 'del', line: from[i - 1]});
			i--;
		}
	}

	return result;
}

/**
 * Produces a unified diff string between `fromText` and `toText`.
 *
 * Returns an empty string when the texts are identical.
 * The output matches the format produced by `diff -u`.
 */
export function unifiedDiff(
	fromText: string,
	toText: string,
	fromLabel: string,
	toLabel: string,
	context = 3,
): string {
	if (fromText === toText) return '';

	const from = fromText.split('\n');
	const to = toText.split('\n');
	const edits = computeEdits(from, to);

	// Annotate each edit with 1-based line numbers in both files
	let fromLine = 1;
	let toLine = 1;
	const annotated: AnnotatedEdit[] = edits.map(e => {
		const entry: AnnotatedEdit = {...e, fl: fromLine, tl: toLine};
		if (e.kind !== 'add') fromLine++;
		if (e.kind !== 'del') toLine++;
		return entry;
	});

	// Find the indices of all changed edits
	const changeIdxs = annotated
		.map((e, idx) => (e.kind !== 'eq' ? idx : -1))
		.filter(idx => idx >= 0);

	if (changeIdxs.length === 0) return '';

	// Merge change indices into hunk ranges, extending each by `context` lines
	const ranges: Array<{start: number; end: number}> = [];
	let start = Math.max(0, changeIdxs[0] - context);
	let end = Math.min(annotated.length - 1, changeIdxs[0] + context);

	for (let k = 1; k < changeIdxs.length; k++) {
		const next = changeIdxs[k];
		if (next - context <= end + context) {
			// Overlapping or adjacent — extend the current hunk
			end = Math.min(annotated.length - 1, next + context);
		} else {
			ranges.push({start, end});
			start = Math.max(0, next - context);
			end = Math.min(annotated.length - 1, next + context);
		}
	}

	ranges.push({start, end});

	// Render each hunk
	const hunkStrings = ranges.map(range => {
		const slice = annotated.slice(range.start, range.end + 1);

		const fromStart = slice.find(e => e.kind !== 'add')?.fl ?? 0;
		const toStart = slice.find(e => e.kind !== 'del')?.tl ?? 0;

		let fromCount = 0;
		let toCount = 0;
		const lines: string[] = [];

		for (const e of slice) {
			if (e.kind === 'eq') {
				fromCount++;
				toCount++;
				lines.push(' ' + e.line);
			} else if (e.kind === 'del') {
				fromCount++;
				lines.push('-' + e.line);
			} else {
				toCount++;
				lines.push('+' + e.line);
			}
		}

		return [
			`@@ -${fromStart},${fromCount} +${toStart},${toCount} @@`,
			...lines,
		].join('\n');
	});

	return [`--- ${fromLabel}`, `+++ ${toLabel}`, ...hunkStrings].join('\n');
}
