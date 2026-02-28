import {rm} from 'node:fs/promises';
import {
	fetchOidcDiscovery,
	fetchRemoteConfig,
	loadRemoteConfigFromFile,
} from '../config/discovery.js';
import {type RemoteConfig} from '../config/schemas.js';
import {getConfigFilePath, getCredentialsFilePath} from '../config/paths.js';
import {writeConfig} from '../config/store.js';

export type SetupResult = {
	issuer: string;
	clientId: string;
	configFile: string;
};

export async function resetConfig(configDir?: string): Promise<void> {
	await rm(getConfigFilePath(configDir), {force: true});
	await rm(getCredentialsFilePath(configDir), {force: true});
}

async function runSetup(
	remoteConfig: RemoteConfig,
	configDir?: string,
): Promise<SetupResult> {
	const discovery = await fetchOidcDiscovery(remoteConfig.discoveryUrl);

	const configFile = writeConfig(
		{
			discoveryUrl: remoteConfig.discoveryUrl,
			clientId: remoteConfig.clientId,
			scopes: remoteConfig.scopes,
			cachedDiscovery: discovery,
			discoveryFetchedAt: new Date().toISOString(),
		},
		configDir,
	);

	return {
		issuer: discovery.issuer,
		clientId: remoteConfig.clientId,
		configFile: configFile,
	};
}

export async function runSetupCli(
	configUrl: string,
	configDir?: string,
	options?: {reset?: boolean},
): Promise<SetupResult> {
	if (options?.reset) await resetConfig(configDir);
	const remoteConfig = await fetchRemoteConfig(configUrl);
	return runSetup(remoteConfig, configDir);
}

export async function runSetupFromFile(
	configFile: string,
	configDir?: string,
	options?: {reset?: boolean},
): Promise<SetupResult> {
	if (options?.reset) await resetConfig(configDir);
	const remoteConfig = loadRemoteConfigFromFile(configFile);
	return runSetup(remoteConfig, configDir);
}

export async function runSetupFromEnvironment(
	configDir?: string,
	options?: {reset?: boolean},
): Promise<SetupResult> {
	if (options?.reset) await resetConfig(configDir);
	const discoveryUrl = process.env['AITOOL_AUTH_DISCOVERY'];
	const clientId = process.env['AITOOL_AUTH_CLIENT_ID'];

	if (!discoveryUrl)
		throw new Error('Environment variable AITOOL_AUTH_DISCOVERY is not set.');
	if (!clientId)
		throw new Error('Environment variable AITOOL_AUTH_CLIENT_ID is not set.');

	return runSetup(
		{
			discoveryUrl,
			clientId,
			scopes: ['openid', 'profile', 'email', 'offline_access'],
		},
		configDir,
	);
}
