import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
	type LocalConfig,
	type OidcDiscovery,
	OidcDiscoverySchema,
	type RemoteConfig,
	RemoteConfigSchema,
} from './schemas.js';
import {writeConfig} from './store.js';

function verbose(msg: string): void {
	if (process.env['AITOOL_VERBOSE'] === '1') {
		console.error(`[verbose] ${msg}`);
	}
}

export async function fetchRemoteConfig(url: string): Promise<RemoteConfig> {
	verbose(`GET ${url}`);
	const response = await fetch(url);
	verbose(`Response: ${response.status} ${response.statusText}`);
	if (!response.ok) {
		throw new Error(`Failed to fetch config (${response.status}): ${url}`);
	}

	const data = (await response.json()) as unknown;
	return RemoteConfigSchema.parse(data);
}

export function loadRemoteConfigFromFile(filePath: string): RemoteConfig {
	const absolutePath = resolve(filePath);
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(absolutePath, 'utf-8'));
	} catch (err) {
		throw new Error(`Failed to read config file: ${absolutePath}`);
	}

	return RemoteConfigSchema.parse(raw);
}

export async function fetchOidcDiscovery(
	discoveryUrl: string,
): Promise<OidcDiscovery> {
	verbose(`GET ${discoveryUrl}`);
	const response = await fetch(discoveryUrl);
	verbose(`Response: ${response.status} ${response.statusText}`);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch OIDC discovery document (${response.status}): ${discoveryUrl}`,
		);
	}

	const data = (await response.json()) as unknown;
	return OidcDiscoverySchema.parse(data);
}

const DISCOVERY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isDiscoveryCacheStale(fetchedAt: string | undefined): boolean {
	if (!fetchedAt) return true;
	return Date.now() - new Date(fetchedAt).getTime() > DISCOVERY_TTL_MS;
}

/**
 * Returns the OIDC discovery document, using the cached version if fresh.
 * If stale or missing, re-fetches and persists the updated cache.
 */
export async function getDiscovery(
	config: LocalConfig,
	configDir?: string,
): Promise<OidcDiscovery> {
	if (
		config.cachedDiscovery &&
		!isDiscoveryCacheStale(config.discoveryFetchedAt)
	) {
		verbose(
			`Cache hit: discovery document (fetched at ${config.discoveryFetchedAt})`,
		);
		return config.cachedDiscovery;
	}

	verbose('Cache miss: discovery document is stale or missing, re-fetching');
	const discovery = await fetchOidcDiscovery(config.discoveryUrl);
	writeConfig(
		{
			...config,
			cachedDiscovery: discovery,
			discoveryFetchedAt: new Date().toISOString(),
		},
		configDir,
	);
	return discovery;
}
