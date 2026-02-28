import * as fs from 'node:fs';
import {credentialsExist} from '../config/store.js';
import {getCredentialsFilePath} from '../config/paths.js';

export function runAuthLogout(configDir?: string): boolean {
	if (!credentialsExist(configDir)) {
		return false;
	}

	fs.unlinkSync(getCredentialsFilePath(configDir));
	return true;
}
