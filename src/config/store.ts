import * as fs from 'node:fs';
import * as path from 'node:path';
import {type Credentials, CredentialsSchema, type LocalConfig, LocalConfigSchema} from './schemas.js';
import {getConfigDir, getConfigFilePath, getCredentialsFilePath} from './paths.js';

export function configExists(configDir?: string): boolean {
	return fs.existsSync(getConfigFilePath(configDir));
}

export function readConfig(configDir?: string): LocalConfig {
	const filePath = getConfigFilePath(configDir);
	const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
	return LocalConfigSchema.parse(raw);
}

export function writeConfig(config: LocalConfig, configDir?: string): string {
	const dir = configDir ?? getConfigDir();
	fs.mkdirSync(dir, {recursive: true});
	const filePath = path.join(dir, 'config.json');
	fs.writeFileSync(filePath, JSON.stringify(config, null, 2), {mode: 0o600});

	return filePath;
}

export function credentialsExist(configDir?: string): boolean {
	return fs.existsSync(getCredentialsFilePath(configDir));
}

export function readCredentials(configDir?: string): Credentials {
	const filePath = getCredentialsFilePath(configDir);
	const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
	return CredentialsSchema.parse(raw);
}

export function writeCredentials(credentials: Credentials, configDir?: string): void {
	const dir = configDir ?? getConfigDir();
	fs.mkdirSync(dir, {recursive: true});
	const filePath = getCredentialsFilePath(configDir ?? dir);
	fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), {mode: 0o600});
}
