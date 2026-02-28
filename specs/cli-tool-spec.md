# AI Tools Config CLI — Technical Specification

## Overview

A cross-platform CLI tool built with **Bun + Ink** that authenticates corporate developers via
SSO (OIDC) and manages local configuration for AI tool usage (e.g., Claude Code, Copilot, etc.).

---

## Architecture

### Tech Stack

- **Runtime**: Bun
- **TUI**: Ink (React-based terminal UI)
- **Auth**: OIDC Device Authorization Grant (RFC 8628) — best fit for CLI flows
- **Config format**: JSON or TOML
- **HTTP**: Native `fetch` (Bun built-in)

### Dual-Mode Requirement

Every command must work in two modes:

| Mode              | Trigger                    | Output                      | Use case                   |
| ----------------- | -------------------------- | --------------------------- | -------------------------- |
| **TUI** (default) | interactive terminal       | Ink-rendered UI             | Developer workstations     |
| **CLI**           | `--no-tui` flag or non-TTY | Plain text / JSON to stdout | CI/CD, scripts, automation |

The `--no-tui` flag (or automatic detection of a non-TTY environment via `process.stdout.isTTY === false`) must suppress
all Ink rendering and produce machine-readable output instead. No command may require an interactive prompt to
complete — every required input must be expressible as a flag.

---

## Feature Specifications

### 1. First-Run Bootstrap

**Trigger**: CLI invoked with no existing config file.

**Flow**:

1. Detect missing config (see Config Storage below)
2. Launch Ink-based setup wizard:
   - Prompt: Single config URL (e.g., `https://corp.com/.well-known/aitool.json`)
3. Fetch the config document from that URL — it contains the OIDC well-known endpoint and the required client ID
4. Fetch and validate the OIDC well-known document referenced in the config
5. Persist config to platform-appropriate location
6. Proceed to authentication

**Config document schema** (fetched from the provided URL):

```json
{
	"discoveryUrl": "https://auth.corp.com/.well-known/openid-configuration",
	"clientId": "aitool-cli",
	"scopes": ["openid", "profile"]
}
```

**Validation**:

- Config URL must return a valid JSON document containing at minimum `discoveryUrl` and `clientId`
- Fetched well-known document must be a valid OIDC discovery document
- Required well-known fields: `issuer`, `authorization_endpoint`, `token_endpoint`, `device_authorization_endpoint`

---

### 2. OIDC Authentication (Device Authorization Grant)

**Why Device Flow**: No browser redirect complexity; works headlessly; standard for CLI/native apps.

**Flow**:

1. POST to `device_authorization_endpoint` with `client_id` + `scope`
2. Display `user_code` and `verification_uri` to user via Ink UI
3. Poll `token_endpoint` until user completes browser auth or timeout
4. Store tokens (access + refresh) in config/credential store
5. On subsequent runs: check token expiry → refresh if needed → re-auth if refresh fails

**Token Storage**:

- Store in the same config directory, separate `credentials.json` file
- Sensitive file permissions: `0600` (Unix), restricted ACL (Windows)
- Consider OS keychain integration as a v2 enhancement (e.g., via `keytar`)

---

### 3. Well-Known Configuration Cache

Mirrors OAuth2 well-known pattern:

```json
{
	"discoveryUrl": "https://auth.corp.com/.well-known/openid-configuration",
	"clientId": "aitool-cli",
	"scopes": [
		"openid",
		"profile"
	],
	"cachedDiscovery": {
		...
	},
	"discoveryFetchedAt": "2025-01-01T00:00:00Z"
}
```

- Cache the fetched OIDC discovery document locally
- Re-fetch if stale (configurable TTL, default 24h)
- `--refresh-config` flag forces re-fetch

---

### 4. Cross-Platform Config Storage

| Platform | Config Path                                       |
| -------- | ------------------------------------------------- |
| macOS    | `~/Library/Application Support/aitool/`           |
| Linux    | `$XDG_CONFIG_HOME/aitool/` or `~/.config/aitool/` |
| Windows  | `%APPDATA%\aitool\`                               |

**Implementation**:

```typescript
function getConfigDir(): string {
	switch (process.platform) {
		case 'darwin':
			return path.join(
				os.homedir(),
				'Library',
				'Application Support',
				'aitool',
			);
		case 'win32':
			return path.join(process.env.APPDATA ?? os.homedir(), 'aitool');
		default:
			return path.join(
				process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'),
				'aitool',
			);
	}
}
```

**Files**:

```
<config-dir>/
  config.json       # well-known URL, client config, preferences
  credentials.json  # tokens (chmod 0600)
```

---

## CLI Command Structure

```
aitool [command] [flags]

Commands:
  setup           Re-run first-time setup wizard
  auth login      Authenticate / re-authenticate
  auth logout     Clear stored tokens
  auth status     Show current auth status, token expiry, active config
  config get <key>
  config set <key> <value>
  config show     Dump current config (redacting secrets)

Flags:
  --config-dir    Override config directory path
  --verbose       Debug output
  --no-tui        Non-interactive/pipe-friendly output (also auto-enabled when stdout is not a TTY)
  --output        Output format: text (default), json

CLI-mode flag equivalents (all interactive prompts must have a flag counterpart):
  setup  --config-url <url> | --config-file <path> | --auto
  auth login  (no additional flags; device flow prints code + URL to stdout and polls silently)
  auth logout (no flags required)
  auth status --output json
  config get <key>
  config set <key> <value>
  config show
```

---

## Ink TUI Components

Each component has a plain-text CLI equivalent used when `--no-tui` is active or stdout is not a TTY.

| Component            | Purpose                                        | CLI-mode equivalent                             |
| -------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `<SetupWizard>`      | Multi-step first-run flow                      | Accepts `--config-url`; prints result to stdout |
| `<DeviceCodePrompt>` | Shows user_code + verification_uri + countdown | Prints `code` and `url` as plain text / JSON    |
| `<AuthPoller>`       | Spinner while polling token endpoint           | Silent poll; prints success or error on exit    |
| `<StatusDashboard>`  | `aitool status` output                         | Structured text or `--output json`              |
| `<ConfigEditor>`     | Interactive config review/edit                 | `config get/set/show` subcommands               |

---

## Error Handling

- **Network errors** during well-known fetch: clear message + retry option
- **Auth timeout** (device flow): re-prompt with option to retry
- **Token refresh failure**: auto-trigger re-auth flow
- **Corrupt config**: warn + offer to reset (`aitool setup --reset`)
- **Unsupported platform**: graceful fallback to `~/.aitool/`

---

## Security Considerations

- Never log tokens or client secrets
- `credentials.json` created with restrictive permissions at write time
- Warn if config directory permissions are too open
- `--no-tui` mode should not echo sensitive values

---

## Implementation Phases

### Phase 1 — Core

- Config detection + storage
- First-run wizard (Ink) + `--config-url` CLI equivalent
- OIDC well-known fetch + cache
- `--no-tui` / TTY detection as a cross-cutting concern from day one

### Phase 2 — Auth

- Device Authorization Grant flow
- Token storage + refresh logic
- `login` / `logout` / `status` commands (TUI + CLI modes)

### Phase 3 — Polish

- `config get/set/show` commands
- Token expiry warnings on every invocation
- Shell completion scripts

---

## Key Dependencies

```json
{
	"ink": "^5.x",
	"react": "^18.x",
	"commander": "^14.x",
	"zod": "^4.x"
}
```

Bun's native `fetch`, `crypto`, and `fs` cover the rest — no need for axios, node-fetch, or dedicated OIDC libraries
given the narrow Device Flow scope.
