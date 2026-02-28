#!/usr/bin/env bash
# install.sh — Install or update aitool from GitHub Releases
set -euo pipefail

REPO="ShawInnes/aitool-cli"
BINARY_NAME="aitool"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

# ── Platform detection ────────────────────────────────────────────────────────

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PLATFORM="darwin" ;;
  Linux)  PLATFORM="linux"  ;;
  *)
    echo "Unsupported OS: $OS" >&2
    echo "Download manually from: https://github.com/${REPO}/releases/latest" >&2
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64)        ARCH_SUFFIX="x64"   ;;
  arm64|aarch64) ARCH_SUFFIX="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

ASSET_NAME="${BINARY_NAME}-${PLATFORM}-${ARCH_SUFFIX}"

# ── Fetch latest release tag ──────────────────────────────────────────────────

echo "Fetching latest release..."
LATEST="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' \
  | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"

if [ -z "$LATEST" ]; then
  echo "Failed to determine latest version." >&2
  exit 1
fi

echo "Latest version: ${LATEST}"

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${ASSET_NAME}"
CHECKSUM_URL="https://github.com/${REPO}/releases/download/${LATEST}/checksums.txt"

# ── Download binary ───────────────────────────────────────────────────────────

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

echo "Downloading ${ASSET_NAME}..."
curl -fsSL --progress-bar "$DOWNLOAD_URL" -o "$TMP_FILE"

# ── Verify checksum ───────────────────────────────────────────────────────────

if command -v sha256sum &>/dev/null; then
  HASH_CMD="sha256sum"
elif command -v shasum &>/dev/null; then
  HASH_CMD="shasum -a 256"
else
  echo "Warning: no SHA-256 tool found, skipping checksum verification." >&2
  HASH_CMD=""
fi

if [ -n "$HASH_CMD" ]; then
  CHECKSUMS="$(curl -fsSL "$CHECKSUM_URL")"
  EXPECTED="$(echo "$CHECKSUMS" | grep "$ASSET_NAME" | awk '{print $1}')"

  if [ -n "$EXPECTED" ]; then
    ACTUAL="$(eval "$HASH_CMD" "$TMP_FILE" | awk '{print $1}')"
    if [ "$EXPECTED" != "$ACTUAL" ]; then
      echo "Checksum mismatch!" >&2
      echo "  Expected: $EXPECTED" >&2
      echo "  Got:      $ACTUAL" >&2
      exit 1
    fi
    echo "Checksum verified."
  else
    echo "Warning: could not find checksum for ${ASSET_NAME}, skipping." >&2
  fi
fi

# ── Install ───────────────────────────────────────────────────────────────────

chmod +x "$TMP_FILE"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
else
  echo "Installing to ${INSTALL_DIR} (requires sudo)..."
  sudo mv "$TMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo ""
echo "Installed ${BINARY_NAME} ${LATEST} → ${INSTALL_DIR}/${BINARY_NAME}"
echo "Run '${BINARY_NAME} --help' to get started."
