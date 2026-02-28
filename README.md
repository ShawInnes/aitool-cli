# aitool-cli

> A CLI tool built with [Ink](https://github.com/vadimdemedes/ink) and compiled to standalone binaries
> via [Bun](https://bun.sh).

## Install

**macOS / Linux:**

```sh
curl -fsSL https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.ps1 | iex
```

### Manual download

Download the binary that matches your platform from
the [latest release](https://github.com/ShawInnes/aitool-cli/releases/latest):

| Platform      | Binary                 |
|---------------|------------------------|
| macOS (Apple) | `aitool-darwin-arm64`  |
| macOS (Intel) | `aitool-darwin-x64`    |
| Linux (x64)   | `aitool-linux-x64`     |
| Linux (ARM64) | `aitool-linux-arm64`   |
| Windows (x64) | `aitool-win-x64.exe`   |
| Windows (ARM) | `aitool-win-arm64.exe` |

Then make it executable and move it onto your PATH:

```bash
chmod +x aitool-darwin-arm64
mv aitool-darwin-arm64 /usr/local/bin/aitool
```

A `checksums.txt` file is included with each release so you can verify the download:

```bash
# Download checksums
curl -fsSL https://github.com/ShawInnes/aitool-cli/releases/latest/download/checksums.txt -o checksums.txt

# Verify (Linux)
sha256sum --check --ignore-missing checksums.txt

# Verify (macOS)
shasum -a 256 --check --ignore-missing checksums.txt
```

### Windows

Download `aitool-win-x64.exe` (or `aitool-win-arm64.exe`) from
the [latest release](https://github.com/ShawInnes/aitool-cli/releases/latest), rename it to `aitool.exe`, and add its
location to your `PATH`.

## Update

### Self-update (macOS / Linux)

The binary can update itself in place:

```bash
aitool update
```

This checks GitHub for a newer release, downloads the matching binary, verifies its checksum, and atomically replaces
the running binary. Restart your shell afterward.

### Self-update (Windows)

The self-updater downloads the new binary alongside the current one and prints the rename command needed to complete the
update (Windows does not allow overwriting a running executable).

### Re-run the install script

Running the install script again will always fetch and install the latest version:

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.sh | sh

# Windows (PowerShell)
irm https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.ps1 | iex
```

## CLI

```
Usage
  $ aitool [command]

Commands
  update    Update to the latest version
  version   Print the current version

Options
  --name  Your name

Examples
  $ aitool --name=Jane
  Hello, Jane

  $ aitool version
  $ aitool update
```

## Releases

Releases are automated via GitHub Actions. To publish a new version:

1. Bump the version in `package.json`
2. Commit and push
3. Create and push a tag:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The [release workflow](.github/workflows/release.yml) will build binaries for all six platforms, generate
`checksums.txt`, and publish a GitHub Release automatically.

## Development

```bash
bun install
bun run dev
```

Build all platform binaries:

```bash
bun run build:all
```
