# aitool-cli

A terminal UI for browsing LLM model pricing and context windows, powered by [LiteLLM's model data](https://github.com/BerriAI/litellm).

## Install

**macOS / Linux:**
```sh
curl -fsSL https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.ps1 | iex
```

## Development

```bash
bun install   # Install dependencies
bun dev       # Run with hot-reload
```

## Build

Build a standalone executable for the current platform:

```bash
bun run build:darwin-arm64   # macOS (Apple Silicon)
bun run build:darwin-x64     # macOS (Intel)
bun run build:linux-x64      # Linux x64
bun run build:linux-arm64    # Linux arm64
bun run build:win-x64        # Windows x64
bun run build:all            # All platforms
```

Binaries are written to `dist/`. They embed the Bun runtime and the native OpenTUI library — no Bun installation required on the target machine.

## Releasing

Releases are automated via GitHub Actions. The workflow builds all platform binaries in parallel on native runners and uploads them to a GitHub Release.

### Steps

1. **Ensure the main branch is clean and tests pass.**

2. **Tag the release** using semantic versioning:
   ```sh
   git tag v1.2.3
   git push origin v1.2.3
   ```

3. **GitHub Actions triggers automatically** on the `v*` tag push. The workflow:
   - Builds `aitool-darwin-arm64`, `aitool-darwin-x64`, `aitool-linux-x64`, `aitool-linux-arm64`, and `aitool-win-x64.exe` on their respective native runners
   - Creates a GitHub Release at the tag with auto-generated release notes
   - Attaches all five binaries as release assets

4. **Verify** the release at `https://github.com/ShawInnes/aitool-cli/releases`. Confirm each binary is present and the install scripts work on a clean machine.

### Deleting a bad tag

```sh
git tag -d v1.2.3              # delete locally
git push origin :refs/tags/v1.2.3  # delete remotely
```

Then re-tag and push once the issue is fixed.
