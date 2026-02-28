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

  const expiresAt = new Date(credentials.expiresAt);
  const now = new Date();
  const minutesUntilExpiry = Math.floor(
    (expiresAt.getTime() - now.getTime()) / (1000 * 60)
  );

  if (minutesUntilExpiry <= 0) {
    console.error('⚠ Your token has expired. Run `aitool auth login` to re-authenticate.');
  } else if (minutesUntilExpiry <= 5) {
    console.error(
      `⚠ Your token expires in ${minutesUntilExpiry} minute${minutesUntilExpiry === 1 ? '' : 's'}. Run \`aitool auth login\` to re-authenticate.`
    );
  }
}
