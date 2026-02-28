import {readConfig} from '../config/store.js';

export type ConfigShowResult = {
	discoveryUrl: string;
	clientId: string;
	scopes: string[];
	cachedDiscovery?: {
		issuer: string;
		authorization_endpoint: string;
		token_endpoint: string;
		device_authorization_endpoint: string;
	};
	discoveryFetchedAt?: string;
};

export function runConfigShow(configDir?: string): ConfigShowResult {
	const config = readConfig(configDir);
	return {
		discoveryUrl: config.discoveryUrl,
		clientId: config.clientId,
		scopes: config.scopes,
		cachedDiscovery: config.cachedDiscovery,
		discoveryFetchedAt: config.discoveryFetchedAt,
	};
}
