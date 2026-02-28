import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import {
	configExists,
	credentialsExist,
	readConfig,
	readCredentials,
} from '../config/store.js';

dayjs.extend(relativeTime);

export type TokenStatus = 'valid' | 'expiring_soon' | 'expired' | 'unknown';

export type AuthStatusResult = {
	configured: boolean;
	authenticated: boolean;
	issuer?: string;
	clientId?: string;
	scopes?: string[];
	tokenStatus: TokenStatus;
	expiresAt?: string;
	scope?: string;
};

const EXPIRING_SOON_MS = 5 * 60 * 1000; // 5 minutes

export function formatRelativeTime(isoDate: string): string {
	return dayjs(isoDate).fromNow();
}

function getTokenStatus(expiresAt: string | undefined): TokenStatus {
	if (!expiresAt) return 'unknown';
	const ms = new Date(expiresAt).getTime() - Date.now();
	if (ms <= 0) return 'expired';
	if (ms <= EXPIRING_SOON_MS) return 'expiring_soon';
	return 'valid';
}

export function runAuthStatus(configDir?: string): AuthStatusResult {
	if (!configExists(configDir)) {
		return {configured: false, authenticated: false, tokenStatus: 'unknown'};
	}

	const config = readConfig(configDir);
	const issuer = config.cachedDiscovery?.issuer;

	if (!credentialsExist(configDir)) {
		return {
			configured: true,
			authenticated: false,
			issuer,
			clientId: config.clientId,
			scopes: config.scopes,
			tokenStatus: 'unknown',
		};
	}

	const creds = readCredentials(configDir);
	const tokenStatus = getTokenStatus(creds.expiresAt);

	return {
		configured: true,
		authenticated: tokenStatus !== 'expired',
		issuer,
		clientId: config.clientId,
		scopes: config.scopes,
		tokenStatus,
		expiresAt: creds.expiresAt,
	};
}
