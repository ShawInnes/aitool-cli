import {getDiscovery} from '../config/discovery.js';
import {credentialsExist, readConfig, readCredentials} from '../config/store.js';
import {runTokenRefresh} from './auth.js';

export async function runAuthUserinfo(configDir?: string): Promise<Record<string, unknown>> {
	if (!credentialsExist(configDir)) {
		throw new Error('Not authenticated. Run `aitool auth login` first.');
	}

	const refreshResult = await runTokenRefresh(configDir);
	if (refreshResult.status === 'no_credentials') {
		throw new Error('Not authenticated. Run `aitool auth login` first.');
	}

	if (refreshResult.status === 'failed') {
		throw new Error(`Token refresh failed: ${refreshResult.error}. Run \`aitool auth login\` to re-authenticate.`);
	}

	const config = readConfig(configDir);
	const discovery = await getDiscovery(config, configDir);

	if (!discovery.userinfo_endpoint) {
		throw new Error('The configured identity provider does not expose a userinfo endpoint.');
	}

	const credentials = readCredentials(configDir);

	const response = await fetch(discovery.userinfo_endpoint, {
		headers: {Authorization: `${credentials.tokenType} ${credentials.accessToken}`},
	});

	if (response.status === 401) {
		throw new Error('Access token is invalid or expired. Run `aitool auth login` to re-authenticate.');
	}

	if (!response.ok) {
		throw new Error(`Userinfo request failed (${response.status}): ${discovery.userinfo_endpoint}`);
	}

	return (await response.json()) as Record<string, unknown>;
}
