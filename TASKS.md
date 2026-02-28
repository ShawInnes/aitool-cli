# Outstanding Tasks

Derived from `specs/cli-tool-spec.md`. Implemented features are excluded.

---

## Essential

### Token Refresh

**Spec ref**: §2 — "On subsequent runs: check token expiry → refresh if needed → re-auth if refresh fails"

On any command that requires authentication, check if the access token is expired (or expiring soon) and attempt a silent refresh using the stored `refresh_token` before proceeding. If the refresh fails, prompt the user to re-authenticate.

- Add `runTokenRefresh(configDir?)` in `src/commands/auth.ts` — POST `grant_type=refresh_token` to `token_endpoint`
- Call before any authenticated operation (`auth userinfo`, etc.)
- On refresh failure: throw with a message directing the user to `aitool auth login`

---

### `config get <key>` and `config set <key> <value>`

**Spec ref**: §CLI Command Structure

Read or write a single top-level key from `config.json`.

- `aitool config get discoveryUrl` — prints the value
- `aitool config set clientId my-client` — updates the key and saves
- Add execution functions to `src/commands/config.ts`
- Restrict `set` to non-sensitive, user-facing keys (`clientId`, `scopes`, `discoveryUrl`)

---

### `setup --reset` flag

**Spec ref**: §Error Handling — "Corrupt config: warn + offer to reset (`aitool setup --reset`)"

Add `--reset` flag to the `setup` command that deletes `config.json` and `credentials.json` before running setup, allowing recovery from a corrupt config state.

---

## Polish

### Token expiry warning on every invocation

**Spec ref**: §Phase 3 — "Token expiry warnings on every invocation"

Before executing any command, check `credentials.json` for an expiring or expired token and print a warning (e.g. `⚠ Your token expires in 4 minutes. Run \`aitool auth login\` to re-authenticate.`).

---

### `--verbose` global flag

**Spec ref**: §CLI Command Structure — `--verbose  Debug output`

Add `--verbose` to the root `program` options. When set, log HTTP request URLs, response status codes, cache hit/miss decisions, and file paths being read/written.
