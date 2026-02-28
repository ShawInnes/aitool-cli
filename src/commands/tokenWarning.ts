import {credentialsExist, readCredentials} from '../config/store.js';

/**
 * Print a warning to stderr if the stored access token is expired or expiring soon.
 */
export function warnIfTokenExpiring(configDir?: string): void {
	if (!credentialsExist(configDir)) {
		return;
	}

	const credentials = readCredentials(configDir);
	if (!credentials.expiresAt) {
		return;
	}

	const msUntilExpiry = new Date(credentials.expiresAt).getTime() - Date.now();

	if (msUntilExpiry <= 0) {
		console.error('Warning: Your token has expired. Run `aitool auth login` to re-authenticate.');
		return;
	}

	const minutesUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60));
	if (minutesUntilExpiry <= 5) {
		console.error(
			`Warning: Your token expires in ${minutesUntilExpiry} minute${minutesUntilExpiry === 1 ? '' : 's'}. Run \`aitool auth login\` to re-authenticate.`,
		);
	}
}
