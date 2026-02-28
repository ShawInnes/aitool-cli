import {chmodSync, mkdirSync, renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pkg from '../package.json';
const CURRENT_VERSION = pkg.version;

const REPO = 'ShawInnes/aitool-cli';
const BINARY_NAME = 'aitool';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPlatformAssets(): {archive: string; binary: string} {
	const key = `${process.platform}-${process.arch}`;
	const map: Record<string, {archive: string; binary: string}> = {
		'darwin-arm64': {
			archive: 'aitool-darwin-arm64.tar.gz',
			binary: 'aitool-darwin-arm64',
		},
		'darwin-x64': {
			archive: 'aitool-darwin-x64.tar.gz',
			binary: 'aitool-darwin-x64',
		},
		'linux-x64': {
			archive: 'aitool-linux-x64.tar.gz',
			binary: 'aitool-linux-x64',
		},
		'linux-arm64': {
			archive: 'aitool-linux-arm64.tar.gz',
			binary: 'aitool-linux-arm64',
		},
		'win32-x64': {archive: 'aitool-win-x64.zip', binary: 'aitool-win-x64.exe'},
		'win32-arm64': {
			archive: 'aitool-win-arm64.zip',
			binary: 'aitool-win-arm64.exe',
		},
	};
	const assets = map[key];
	if (!assets) throw new Error(`No release binary for platform: ${key}`);
	return assets;
}

function compareVersions(a: string, b: string): number {
	const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
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
	archivePath: string,
	archiveName: string,
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
	const line = text.split('\n').find(l => l.includes(archiveName));
	const expected = line?.split(/\s+/)[0];
	if (!expected) {
		console.warn(`Warning: no checksum found for ${archiveName}, skipping.`);
		return;
	}

	const file = Bun.file(archivePath);
	const buffer = await file.arrayBuffer();
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

async function spawnAndCheck(cmd: string[]): Promise<void> {
	const proc = Bun.spawn(cmd, {stderr: 'inherit'});
	const code = await proc.exited;
	if (code !== 0)
		throw new Error(`Command failed (exit ${code}): ${cmd.join(' ')}`);
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

	const {archive, binary} = getPlatformAssets();
	const url = `https://github.com/${REPO}/releases/download/v${latest}/${archive}`;

	const res = await fetch(url, {headers: {'User-Agent': BINARY_NAME}});
	if (!res.ok) throw new Error(`Download failed: ${res.status}`);

	const tmpDir = join(tmpdir(), `${BINARY_NAME}-update-${Date.now()}`);
	const archivePath = join(tmpDir, archive);
	mkdirSync(tmpDir, {recursive: true});
	await Bun.write(archivePath, await res.arrayBuffer());

	await verifyChecksum(archivePath, archive, latest);

	if (process.platform === 'win32') {
		// Windows: cannot replace a running .exe — extract alongside and instruct user.
		await spawnAndCheck([
			'powershell',
			'-NoProfile',
			'-Command',
			`Expand-Archive -Path '${archivePath}' -DestinationPath '${tmpDir}' -Force`,
		]);
		const extractedExe = join(tmpDir, binary);
		const dest = process.execPath.replace(/\.exe$/i, '') + '-new.exe';
		renameSync(extractedExe, dest);
		console.log(`\nDownloaded new binary to: ${dest}`);
		console.log(
			`To complete the update, replace the current binary:\n` +
				`  move /Y "${dest}" "${process.execPath}"`,
		);
		return;
	}

	// Unix: extract tar.gz, then atomically rename over the running binary.
	await spawnAndCheck(['tar', 'xzf', archivePath, '-C', tmpDir]);
	const extractedBin = join(tmpDir, binary);
	chmodSync(extractedBin, 0o755);
	renameSync(extractedBin, process.execPath);

	console.log(
		`\nUpdated to ${latest}. Restart ${BINARY_NAME} to use the new version.`,
	);
}
