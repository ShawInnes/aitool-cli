import {exec} from 'node:child_process';
import {getDiscovery} from '../config/discovery.js';
import {
	type Credentials,
	DeviceAuthResponseSchema,
	TokenResponseSchema,
} from '../config/schemas.js';
import {
	credentialsExist,
	readConfig,
	readCredentials,
	writeCredentials,
} from '../config/store.js';

function verbose(msg: string): void {
	if (process.env['AITOOL_VERBOSE'] === '1') {
		console.error(`[verbose] ${msg}`);
	}
}

export type DeviceAuthStart = {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete?: string;
	expiresIn: number;
	interval: number;
};

export type AuthLoginResult = {
	tokenType: string;
	scope?: string;
	expiresAt?: string;
};

export function openBrowser(url: string): void {
	const cmd =
		process.platform === 'win32'
			? `start "" "${url}"`
			: process.platform === 'darwin'
			? `open "${url}"`
			: `xdg-open "${url}"`;
	exec(cmd, () => {
		/* fire and forget */
	});
}

export async function startDeviceAuth(
	configDir?: string,
): Promise<DeviceAuthStart> {
	const config = readConfig(configDir);
	const discovery = await getDiscovery(config, configDir);

	const body = new URLSearchParams({
		client_id: config.clientId,
		scope: config.scopes.join(' '),
	});

	verbose(`POST ${discovery.device_authorization_endpoint}`);
	const response = await fetch(discovery.device_authorization_endpoint, {
		method: 'POST',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		body: body.toString(),
	});
	verbose(`Response: ${response.status} ${response.statusText}`);

	if (!response.ok) {
		throw new Error(
			`Device authorization request failed (${response.status}): ${discovery.device_authorization_endpoint}`,
		);
	}

	const data = DeviceAuthResponseSchema.parse(
		(await response.json()) as unknown,
	);

	return {
		deviceCode: data.device_code,
		userCode: data.user_code,
		verificationUri: data.verification_uri,
		verificationUriComplete: data.verification_uri_complete,
		expiresIn: data.expires_in,
		interval: data.interval,
	};
}

export async function pollForToken(
	start: DeviceAuthStart,
	configDir?: string,
	onPollAttempt?: () => void,
): Promise<AuthLoginResult> {
	const config = readConfig(configDir);
	const discovery = await getDiscovery(config, configDir);

	const deadline = Date.now() + start.expiresIn * 1000;
	let pollInterval = start.interval;

	while (Date.now() < deadline) {
		await new Promise<void>(resolve =>
			setTimeout(resolve, pollInterval * 1000),
		);
		onPollAttempt?.();

		const body = new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
			device_code: start.deviceCode,
			client_id: config.clientId,
		});

		verbose(`POST ${discovery.token_endpoint}`);
		const response = await fetch(discovery.token_endpoint, {
			method: 'POST',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			body: body.toString(),
		});
		verbose(`Response: ${response.status} ${response.statusText}`);

		const data = (await response.json()) as unknown;

		if (!response.ok) {
			const error = (data as {error?: string}).error;
			if (error === 'authorization_pending') continue;
			if (error === 'slow_down') {
				pollInterval += 5;
				continue;
			}
			if (error === 'expired_token') {
				throw new Error(
					'Device code expired. Please run `aitool auth login` again.',
				);
			}
			if (error === 'access_denied') {
				throw new Error('Access denied.');
			}
			throw new Error(`Token request failed: ${error ?? response.statusText}`);
		}

		const tokens = TokenResponseSchema.parse(data);
		const expiresAt = tokens.expires_in
			? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
			: undefined;

		const credentials: Credentials = {
			accessToken: tokens.access_token,
			tokenType: tokens.token_type,
			refreshToken: tokens.refresh_token,
			idToken: tokens.id_token,
			scope: tokens.scope,
			expiresAt,
		};

		writeCredentials(credentials, configDir);

		return {tokenType: tokens.token_type, scope: tokens.scope, expiresAt};
	}

	throw new Error('Device code expired. Please run `aitool auth login` again.');
}

export async function runAuthLogin(
	configDir?: string,
): Promise<AuthLoginResult> {
	const start = await startDeviceAuth(configDir);
	return pollForToken(start, configDir);
}

export type TokenRefreshResult = {status: 'refreshed'} | {status: 'not_needed'};

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export async function runTokenRefresh(
	configDir?: string,
): Promise<TokenRefreshResult> {
	if (!credentialsExist(configDir)) {
		throw new Error(
			'Not authenticated. Run `aitool auth login` to authenticate.',
		);
	}

	const credentials = readCredentials(configDir);

	if (credentials.expiresAt) {
		const expiresAtMs = new Date(credentials.expiresAt).getTime();
		if (Date.now() < expiresAtMs - TOKEN_REFRESH_BUFFER_MS) {
			return {status: 'not_needed'};
		}
	}
	// If expiresAt is absent, fall through and attempt refresh anyway

	if (!credentials.refreshToken) {
		throw new Error(
			'No refresh token available. Run `aitool auth login` to re-authenticate.',
		);
	}

	const config = readConfig(configDir);
	const discovery = await getDiscovery(config, configDir);

	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: credentials.refreshToken,
		client_id: config.clientId,
	});

	let response: Response;
	try {
		verbose(`POST ${discovery.token_endpoint}`);
		response = await fetch(discovery.token_endpoint, {
			method: 'POST',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			body: body.toString(),
		});
		verbose(`Response: ${response.status} ${response.statusText}`);
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Token refresh failed: ${error}. Run \`aitool auth login\` to re-authenticate.`,
		);
	}

	if (!response.ok) {
		const text = await response.text().catch(() => response.statusText);
		throw new Error(
			`Token refresh failed: ${text}. Run \`aitool auth login\` to re-authenticate.`,
		);
	}

	const data = TokenResponseSchema.parse((await response.json()) as unknown);
	const expiresAt = data.expires_in
		? new Date(Date.now() + data.expires_in * 1000).toISOString()
		: undefined;

	const updatedCredentials: Credentials = {
		accessToken: data.access_token,
		tokenType: data.token_type,
		refreshToken: data.refresh_token ?? credentials.refreshToken,
		idToken: data.id_token ?? credentials.idToken,
		scope: data.scope ?? credentials.scope,
		expiresAt,
	};

	writeCredentials(updatedCredentials, configDir);

	return {status: 'refreshed'};
}
