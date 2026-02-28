import {exec} from 'node:child_process';
import {getDiscovery} from '../config/discovery.js';
import {
	type Credentials,
	DeviceAuthResponseSchema,
	TokenResponseSchema,
} from '../config/schemas.js';
import {readConfig, writeCredentials} from '../config/store.js';

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

export async function startDeviceAuth(configDir?: string): Promise<DeviceAuthStart> {
	const config = readConfig(configDir);
	const discovery = await getDiscovery(config, configDir);

	const body = new URLSearchParams({
		client_id: config.clientId,
		scope: config.scopes.join(' '),
	});

	const response = await fetch(discovery.device_authorization_endpoint, {
		method: 'POST',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		body: body.toString(),
	});

	if (!response.ok) {
		throw new Error(
			`Device authorization request failed (${response.status}): ${discovery.device_authorization_endpoint}`,
		);
	}

	const data = DeviceAuthResponseSchema.parse((await response.json()) as unknown);

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
		await new Promise<void>((resolve) => setTimeout(resolve, pollInterval * 1000));
		onPollAttempt?.();

		const body = new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
			device_code: start.deviceCode,
			client_id: config.clientId,
		});

		const response = await fetch(discovery.token_endpoint, {
			method: 'POST',
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			body: body.toString(),
		});

		const data = (await response.json()) as unknown;

		if (!response.ok) {
			const error = (data as {error?: string}).error;
			if (error === 'authorization_pending') continue;
			if (error === 'slow_down') {
				pollInterval += 5;
				continue;
			}
			if (error === 'expired_token') {
				throw new Error('Device code expired. Please run `aitool auth login` again.');
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

export async function runAuthLogin(configDir?: string): Promise<AuthLoginResult> {
	const start = await startDeviceAuth(configDir);
	return pollForToken(start, configDir);
}
