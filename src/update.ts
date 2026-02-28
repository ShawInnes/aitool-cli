import {chmodSync, renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {version as CURRENT_VERSION} from '../package.json';

const REPO = 'ShawInnes/aitool-cli';
const BINARY_NAME = 'aitool';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPlatformBinary(): string {
	const key = `${process.platform}-${process.arch}`;
	const map: Record<string, string> = {
		'darwin-arm64': 'aitool-darwin-arm64',
		'darwin-x64': 'aitool-darwin-x64',
		'linux-x64': 'aitool-linux-x64',
		'linux-arm64': 'aitool-linux-arm64',
		'win32-x64': 'aitool-win-x64.exe',
		'win32-arm64': 'aitool-win-arm64.exe',
	};
	const bin = map[key];
	if (!bin) throw new Error(`No release binary for platform: ${key}`);
	return bin;
}

function compareVersions(a: string, b: string): number {
	const parse = (v: string) =>
		v
			.replace(/^v/, '')
			.split('.')
			.map(Number);
	const pa = parse(a);
	const pb = parse(b);
	for (let i = 0; i < 3; i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}

	return 0;
}

async function fetchLatestVersion(): Promise<string> {
	const res = await fetch(
		`https://api.github.com/repos/${REPO}/releases/latest`,
		{headers: {'User-Agent': BINARY_NAME}},
	);
	if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
	const data = (await res.json()) as {tag_name: string};
	return data.tag_name.replace(/^v/, '');
}

async function verifyChecksum(
	buffer: ArrayBuffer,
	binaryName: string,
	version: string,
): Promise<void> {
	const res = await fetch(
		`https://github.com/${REPO}/releases/download/v${version}/checksums.txt`,
		{headers: {'User-Agent': BINARY_NAME}},
	);
	if (!res.ok) {
		console.warn('Warning: could not fetch checksums, skipping verification.');
		return;
	}

	const text = await res.text();
	const line = text.split('\n').find((l) => l.includes(binaryName));
	const expected = line?.split(/\s+/)[0];
	if (!expected) {
		console.warn(`Warning: no checksum found for ${binaryName}, skipping.`);
		return;
	}

	const hasher = new Bun.CryptoHasher('sha256');
	hasher.update(buffer);
	const actual = hasher.digest('hex');

	if (actual !== expected) {
		throw new Error(
			`Checksum mismatch!\n  Expected: ${expected}\n  Got:      ${actual}`,
		);
	}

	console.log('Checksum verified.');
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkUpdate(): Promise<void> {
	const latest = await fetchLatestVersion();
	if (compareVersions(latest, CURRENT_VERSION) > 0) {
		console.log(`Update available: ${CURRENT_VERSION} → ${latest}`);
		console.log(`Run \`${BINARY_NAME} update\` to install.`);
	} else {
		console.log(`${BINARY_NAME} is up to date (${CURRENT_VERSION})`);
	}
}

export async function selfUpdate(): Promise<void> {
	const latest = await fetchLatestVersion();

	if (compareVersions(latest, CURRENT_VERSION) <= 0) {
		console.log(`Already up to date (${CURRENT_VERSION})`);
		return;
	}

	console.log(`Updating ${CURRENT_VERSION} → ${latest}...`);

	const binaryName = getPlatformBinary();
	const url = `https://github.com/${REPO}/releases/download/v${latest}/${binaryName}`;

	const res = await fetch(url, {headers: {'User-Agent': BINARY_NAME}});
	if (!res.ok) throw new Error(`Download failed: ${res.status}`);
	const buffer = await res.arrayBuffer();

	await verifyChecksum(buffer, binaryName, latest);

	// Windows: cannot rename over a running .exe — write alongside and instruct user.
	if (process.platform === 'win32') {
		const dest = process.execPath.replace(/\.exe$/i, '') + `-new.exe`;
		await Bun.write(dest, buffer);
		console.log(`\nDownloaded new binary to: ${dest}`);
		console.log(
			`To complete the update, replace the current binary manually:\n` +
				`  move /Y "${dest}" "${process.execPath}"`,
		);
		return;
	}

	// Unix: write to a temp file, then atomically rename over the running binary.
	const tmpPath = join(tmpdir(), `${BINARY_NAME}-update-${Date.now()}`);
	await Bun.write(tmpPath, buffer);
	chmodSync(tmpPath, 0o755);
	renameSync(tmpPath, process.execPath);

	console.log(
		`\nUpdated to ${latest}. Restart ${BINARY_NAME} to use the new version.`,
	);
}
