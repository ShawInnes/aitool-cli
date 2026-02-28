import {readConfig, writeConfig} from '../config/store.js';

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

const ALLOWED_CONFIG_KEYS = ['clientId', 'scopes', 'discoveryUrl'] as const;
type AllowedConfigKey = (typeof ALLOWED_CONFIG_KEYS)[number];

function isAllowedKey(key: string): key is AllowedConfigKey {
	return (ALLOWED_CONFIG_KEYS as readonly string[]).includes(key);
}

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

export async function runConfigGet(
	key: string,
	configDir?: string,
): Promise<void> {
	if (!isAllowedKey(key)) {
		process.stderr.write(
			`Error: "${key}" is not a readable config key. Allowed keys: ${ALLOWED_CONFIG_KEYS.join(
				', ',
			)}\n`,
		);
		process.exit(1);
	}

	const config = readConfig(configDir);
	const value = config[key];

	if (value === undefined) {
		process.stderr.write(`Error: config key "${key}" is not set\n`);
		process.exit(1);
	}

	if (Array.isArray(value)) {
		console.log(value.join(' '));
	} else {
		console.log(value);
	}
}

export async function runConfigSet(
	key: string,
	value: string,
	configDir?: string,
): Promise<void> {
	if (!isAllowedKey(key)) {
		process.stderr.write(
			`Error: "${key}" is not a settable config key. Allowed keys: ${ALLOWED_CONFIG_KEYS.join(
				', ',
			)}\n`,
		);
		process.exit(1);
	}

	const config = readConfig(configDir);

	if (key === 'scopes') {
		config.scopes = value.split(/[\s,]+/).filter(Boolean);
	} else if (key === 'clientId') {
		config.clientId = value;
	} else {
		config.discoveryUrl = value;
	}

	writeConfig(config, configDir);
	const displayValue = key === 'scopes' ? config.scopes.join(' ') : value;
	console.log(`Set ${key} = ${displayValue}`);
}
