import * as os from 'node:os';
import * as path from 'node:path';

export function getConfigDir(): string {
	switch (process.platform) {
		case 'darwin':
			return path.join(
				os.homedir(),
				'Library',
				'Application Support',
				'aitool',
			);
		case 'win32':
			return path.join(process.env['APPDATA'] ?? os.homedir(), 'aitool');
		default:
			return path.join(
				process.env['XDG_CONFIG_HOME'] ?? path.join(os.homedir(), '.config'),
				'aitool',
			);
	}
}

export function getConfigFilePath(configDir?: string): string {
	return path.join(configDir ?? getConfigDir(), 'config.json');
}

export function getCredentialsFilePath(configDir?: string): string {
	return path.join(configDir ?? getConfigDir(), 'credentials.json');
}
