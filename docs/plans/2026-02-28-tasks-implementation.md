# TASKS.md Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement five outstanding features from TASKS.md: token refresh, config get/set, setup --reset, token expiry warnings, and --verbose flag.

**Architecture:** Each task is additive — new functions in existing files with corresponding CLI wiring in cli.tsx. No new files needed except possibly a shared token-check utility. All external data flows through Zod schemas already defined in schemas.ts.

**Tech Stack:** TypeScript, Commander.js, Zod, dayjs, Node.js fetch API

---

## Task 1: Token Refresh (`runTokenRefresh`)

**Files:**

- Modify: `src/commands/auth.ts`

### Step 1: Read the current auth.ts fully

Run: `cat src/commands/auth.ts`

### Step 2: Write the failing test

Add to `test.tsx` (or create `test-auth.ts` — use the existing test file for now):

```typescript
// Token refresh - no test infrastructure for HTTP mocks yet, skip unit tests
// Manual verification plan instead (see Step 5)
```

> Note: The existing test suite uses Ava + ink-testing-library and has no HTTP mocking. Skip unit tests for token refresh and verify manually.

### Step 3: Implement `runTokenRefresh` in `src/commands/auth.ts`

Add this export after the existing imports and before `runAuthLogin`:

```typescript
export type TokenRefreshResult =
	| {status: 'refreshed'}
	| {status: 'not_needed'}
	| {status: 'no_credentials'}
	| {status: 'no_refresh_token'}
	| {status: 'failed'; error: string};

/**
 * Silently refresh the access token using the stored refresh_token.
 * Call this before any authenticated operation.
 * Returns the refresh status — callers decide whether to abort or proceed.
 */
export async function runTokenRefresh(
	configDir?: string,
): Promise<TokenRefreshResult> {
	if (!credentialsExist(configDir)) {
		return {status: 'no_credentials'};
	}

	const credentials = readCredentials(configDir);

	// Not expired yet — nothing to do
	if (credentials.expiresAt) {
		const expiresAt = new Date(credentials.expiresAt);
		const nowPlusFiveMinutes = new Date(Date.now() + 5 * 60 * 1000);
		if (expiresAt > nowPlusFiveMinutes) {
			return {status: 'not_needed'};
		}
	}

	if (!credentials.refreshToken) {
		return {status: 'no_refresh_token'};
	}

	const config = readConfig(configDir);
	const discovery = await getDiscovery(config, configDir);

	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		client_id: config.clientId,
		refresh_token: credentials.refreshToken,
	});

	const response = await fetch(discovery.token_endpoint, {
		method: 'POST',
		headers: {'Content-Type': 'application/x-www-form-urlencoded'},
		body,
	});

	if (!response.ok) {
		const text = await response.text();
		return {status: 'failed', error: `HTTP ${response.status}: ${text}`};
	}

	const json = await response.json();
	const parsed = TokenResponseSchema.safeParse(json);
	if (!parsed.success) {
		return {status: 'failed', error: 'Invalid token response from server'};
	}

	const token = parsed.data;
	const expiresAt = token.expires_in
		? new Date(Date.now() + token.expires_in * 1000).toISOString()
		: undefined;

	writeCredentials(
		{
			accessToken: token.access_token,
			tokenType: token.token_type,
			refreshToken: token.refresh_token ?? credentials.refreshToken,
			idToken: token.id_token,
			scope: token.scope,
			expiresAt,
		},
		configDir,
	);

	return {status: 'refreshed'};
}
```

You'll need these imports at the top of auth.ts (add if missing):

- `readConfig`, `readCredentials`, `credentialsExist`, `writeCredentials` from `../config/store`
- `getDiscovery` from `../config/discovery`
- `TokenResponseSchema` from `../config/schemas`

### Step 4: Wire refresh into `runAuthUserinfo`

In `src/commands/authUserinfo.ts`, before the fetch call, call `runTokenRefresh`. If it returns `{ status: "failed" }` or `{ status: "no_credentials" }`, throw with a message directing user to `aitool auth login`.

Read authUserinfo.ts first, then add at the top of the function body:

```typescript
import {runTokenRefresh} from './auth.js';

// ... inside runAuthUserinfo:
const refreshResult = await runTokenRefresh(configDir);
if (refreshResult.status === 'failed') {
	throw new Error(
		`Token refresh failed: ${refreshResult.error}. Run \`aitool auth login\` to re-authenticate.`,
	);
}
if (refreshResult.status === 'no_credentials') {
	throw new Error(
		'Not authenticated. Run `aitool auth login` to authenticate.',
	);
}
```

### Step 5: Manual verification

```bash
# Build
npm run build 2>&1 | head -20

# Verify the command still works
./dist/aitool-macos-arm64 auth userinfo
```

Expected: userinfo still works. If token was near expiry, it silently refreshed first.

### Step 6: Commit

```bash
git add src/commands/auth.ts src/commands/authUserinfo.ts
git commit -m "feat: add silent token refresh before authenticated operations"
```

---

## Task 2: `config get <key>` and `config set <key> <value>`

**Files:**

- Modify: `src/commands/config.ts`
- Modify: `src/cli.tsx`

### Step 1: Read the current files

```bash
cat src/commands/config.ts
cat src/cli.tsx
```

### Step 2: Add `runConfigGet` and `runConfigSet` to `src/commands/config.ts`

Append these exports after the existing `runConfigShow`:

```typescript
// Keys that are safe to get/set via CLI
const ALLOWED_KEYS = ['clientId', 'scopes', 'discoveryUrl'] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

export type ConfigGetResult =
	| {status: 'ok'; key: string; value: string | string[]}
	| {status: 'not_found'; key: string}
	| {status: 'forbidden'; key: string};

export async function runConfigGet(
	key: string,
	configDir?: string,
): Promise<ConfigGetResult> {
	if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
		return {status: 'forbidden', key};
	}

	const config = readConfig(configDir);
	const value = config[key as AllowedKey];

	if (value === undefined) {
		return {status: 'not_found', key};
	}

	return {status: 'ok', key, value};
}

export type ConfigSetResult =
	| {status: 'ok'; key: string; value: string | string[]}
	| {status: 'forbidden'; key: string}
	| {status: 'invalid'; key: string; error: string};

export async function runConfigSet(
	key: string,
	value: string,
	configDir?: string,
): Promise<ConfigSetResult> {
	if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
		return {status: 'forbidden', key};
	}

	const config = readConfig(configDir);

	if (key === 'scopes') {
		// Accept comma-separated or space-separated scopes
		const scopes = value.split(/[\s,]+/).filter(Boolean);
		config.scopes = scopes;
		writeConfig(config, configDir);
		return {status: 'ok', key, value: scopes};
	}

	// clientId, discoveryUrl — set as plain string
	(config as Record<string, unknown>)[key] = value;
	writeConfig(config, configDir);
	return {status: 'ok', key, value};
}
```

Add `writeConfig` to the import from `../config/store`:

```typescript
import {readConfig, writeConfig} from '../config/store.js';
```

### Step 3: Wire into `src/cli.tsx`

Find the `config` command section in cli.tsx. It currently has only `config show`. Add `config get` and `config set` subcommands:

```typescript
config
	.command('get <key>')
	.description('Get a config value (clientId, scopes, discoveryUrl)')
	.action(async (key: string) => {
		const configDir = program.opts().configDir as string | undefined;
		const result = await runConfigGet(key, configDir);
		if (result.status === 'forbidden') {
			console.error(`Error: '${result.key}' is not a user-configurable key.`);
			console.error(`Allowed keys: clientId, scopes, discoveryUrl`);
			process.exit(1);
		}
		if (result.status === 'not_found') {
			console.error(`Error: key '${result.key}' not found in config.`);
			process.exit(1);
		}
		const display = Array.isArray(result.value)
			? result.value.join(', ')
			: result.value;
		console.log(display);
	});

config
	.command('set <key> <value>')
	.description('Set a config value (clientId, scopes, discoveryUrl)')
	.action(async (key: string, value: string) => {
		const configDir = program.opts().configDir as string | undefined;
		const result = await runConfigSet(key, value, configDir);
		if (result.status === 'forbidden') {
			console.error(`Error: '${result.key}' is not a user-configurable key.`);
			console.error(`Allowed keys: clientId, scopes, discoveryUrl`);
			process.exit(1);
		}
		if (result.status === 'invalid') {
			console.error(`Error: ${result.error}`);
			process.exit(1);
		}
		const display = Array.isArray(result.value)
			? result.value.join(', ')
			: result.value;
		console.log(`Set ${result.key} = ${display}`);
	});
```

Add imports at top of cli.tsx:

```typescript
import {runConfigGet, runConfigSet} from './commands/config.js';
```

### Step 4: Manual verification

```bash
npm run build 2>&1 | head -20

./dist/aitool-macos-arm64 config get clientId
# Expected: prints the clientId value

./dist/aitool-macos-arm64 config get discoveryUrl
# Expected: prints the discoveryUrl

./dist/aitool-macos-arm64 config set clientId test-client-123
# Expected: "Set clientId = test-client-123"

./dist/aitool-macos-arm64 config get clientId
# Expected: "test-client-123"

./dist/aitool-macos-arm64 config get secretKey
# Expected: error about forbidden key

./dist/aitool-macos-arm64 config set scopes "openid profile email"
# Expected: "Set scopes = openid, profile, email"
```

### Step 5: Commit

```bash
git add src/commands/config.ts src/cli.tsx
git commit -m "feat: add config get and config set commands"
```

---

## Task 3: `setup --reset` flag

**Files:**

- Modify: `src/commands/setup.ts`
- Modify: `src/cli.tsx`

### Step 1: Read setup.ts

```bash
cat src/commands/setup.ts
cat src/config/store.ts
```

### Step 2: Add reset logic to `src/commands/setup.ts`

Add a `reset` option to the setup function signature. At the start of `runSetupCli` (or whatever the main setup function is), if `reset` is true, delete both config and credentials files before proceeding.

Read setup.ts first to understand the exact function signature, then modify it to accept `{ reset?: boolean }` in its options param:

```typescript
import {getConfigFilePath, getCredentialsFilePath} from '../config/paths.js';
import {rm} from 'node:fs/promises';

// Inside the setup function, before any other logic:
if (options.reset) {
	const configPath = getConfigFilePath(configDir);
	const credentialsPath = getCredentialsFilePath(configDir);
	await rm(configPath, {force: true});
	await rm(credentialsPath, {force: true});
	console.log('Config reset. Starting fresh setup...');
}
```

### Step 3: Wire `--reset` into `src/cli.tsx`

Find the `setup` command in cli.tsx. Add the `--reset` option:

```typescript
program
	.command('setup')
	.description('Initial setup')
	.option('--config-url <url>', 'Fetch config from remote URL')
	.option('--config-file <path>', 'Load config from local JSON file')
	.option('--auto', 'Load from environment variables')
	.option('--reset', 'Delete existing config and start fresh') // ADD THIS
	.action(async options => {
		const configDir = program.opts().configDir as string | undefined;
		// Pass reset to the command function
		await runSetupCli({...options, configDir});
	});
```

### Step 4: Manual verification

```bash
npm run build 2>&1 | head -20

./dist/aitool-macos-arm64 setup --reset --auto
# Expected: "Config reset. Starting fresh setup..." then normal setup prompts/flow

# Verify reset actually clears files
ls -la ~/Library/Application\ Support/aitool/
```

### Step 5: Commit

```bash
git add src/commands/setup.ts src/cli.tsx
git commit -m "feat: add setup --reset flag to recover from corrupt config"
```

---

## Task 4: Token expiry warning on every invocation

**Files:**

- Create: `src/commands/tokenWarning.ts`
- Modify: `src/cli.tsx`

### Step 1: Create `src/commands/tokenWarning.ts`

```typescript
import {credentialsExist, readCredentials} from '../config/store.js';

/**
 * Print a warning to stderr if the stored access token is expired or expiring soon.
 * Call this at the start of every CLI invocation (via program.hook('preAction')).
 */
export function warnIfTokenExpiring(configDir?: string): void {
	if (!credentialsExist(configDir)) {
		return; // Not authenticated — no warning needed
	}

	const credentials = readCredentials(configDir);
	if (!credentials.expiresAt) {
		return; // No expiry info — can't warn
	}

	const expiresAt = new Date(credentials.expiresAt);
	const now = new Date();
	const minutesUntilExpiry = Math.floor(
		(expiresAt.getTime() - now.getTime()) / (1000 * 60),
	);

	if (minutesUntilExpiry <= 0) {
		console.error(
			`⚠ Your token has expired. Run \`aitool auth login\` to re-authenticate.`,
		);
	} else if (minutesUntilExpiry <= 5) {
		console.error(
			`⚠ Your token expires in ${minutesUntilExpiry} minute${
				minutesUntilExpiry === 1 ? '' : 's'
			}. Run \`aitool auth login\` to re-authenticate.`,
		);
	}
}
```

### Step 2: Wire into `src/cli.tsx` using `program.hook('preAction')`

Commander.js supports hooks. Add this before `program.parseAsync(process.argv)`:

```typescript
import {warnIfTokenExpiring} from './commands/tokenWarning.js';

// Add before program.parseAsync:
program.hook('preAction', () => {
	const configDir = program.opts().configDir as string | undefined;
	warnIfTokenExpiring(configDir);
});
```

### Step 3: Manual verification

```bash
npm run build 2>&1 | head -20

# Run any command — if token is expired, warning appears on stderr
./dist/aitool-macos-arm64 auth status
# If token expired: "⚠ Your token has expired. Run `aitool auth login` to re-authenticate."
# Then the normal command output follows

# Test with no credentials: no warning
./dist/aitool-macos-arm64 --help
# Expected: no warning, just help output
```

### Step 4: Commit

```bash
git add src/commands/tokenWarning.ts src/cli.tsx
git commit -m "feat: warn on every invocation if token is expired or expiring soon"
```

---

## Task 5: `--verbose` global flag

**Files:**

- Modify: `src/cli.tsx`

This task adds the flag definition. Full verbose logging across HTTP calls, file I/O, etc. requires threading a `verbose` flag through every command — that's a large refactor. Per YAGNI, implement only what the spec requires: define the flag, make it available, and add logging in the areas mentioned by the spec (HTTP URLs, response status codes, cache hit/miss, file paths).

### Step 1: Add `--verbose` to root program in `src/cli.tsx`

```typescript
program.option(
	'--verbose',
	'Debug output: HTTP requests, response codes, cache decisions, file paths',
);
```

### Step 2: Create a simple verbose logger utility

Add to `src/cli.tsx` after the `program` options setup, or better yet add inline for now since it's one-liners:

```typescript
// After program options are parsed, expose verbose globally
// Commander parses opts lazily, so we read it in preAction
program.hook('preAction', () => {
	const opts = program.opts();
	if (opts.verbose) {
		process.env['AITOOL_VERBOSE'] = '1';
	}
});
```

Then in `src/config/store.ts`, add optional verbose logging to read/write operations:

```typescript
function verbose(msg: string): void {
	if (process.env['AITOOL_VERBOSE'] === '1') {
		console.error(`[verbose] ${msg}`);
	}
}

// Add verbose() calls at the start of readConfig, writeConfig, readCredentials, writeCredentials:
// verbose(`Reading config from ${filePath}`);
// verbose(`Writing config to ${filePath}`);
```

In `src/config/discovery.ts`, add verbose logging around fetch calls:

```typescript
function verbose(msg: string): void {
	if (process.env['AITOOL_VERBOSE'] === '1') {
		console.error(`[verbose] ${msg}`);
	}
}

// Before each fetch:
// verbose(`GET ${url}`);
// After each fetch:
// verbose(`Response: ${response.status} ${response.statusText}`);
// On cache hit:
// verbose(`Cache hit: discovery document (fetched at ${fetchedAt})`);
// On cache miss:
// verbose(`Cache miss: discovery document is stale or missing, re-fetching`);
```

### Step 3: Manual verification

```bash
npm run build 2>&1 | head -20

./dist/aitool-macos-arm64 --verbose auth status
# Expected: [verbose] lines on stderr showing file paths and any HTTP calls
# Followed by normal auth status output

./dist/aitool-macos-arm64 auth status
# Expected: no [verbose] lines
```

### Step 4: Commit

```bash
git add src/cli.tsx src/config/store.ts src/config/discovery.ts
git commit -m "feat: add --verbose global flag for debug output"
```

---

## Final: Run full test suite

```bash
npm test
```

Expected: all tests pass (existing ink-testing-library tests).

If any TypeScript errors, fix them before declaring done.
