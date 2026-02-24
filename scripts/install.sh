#!/bin/sh
# install.sh — curl-pipe installer for aitool-cli on macOS and Linux
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.sh | sh
#
# Override install directory:
#   INSTALL_DIR=/usr/local/bin curl -fsSL ... | sh

set -e

REPO="ShawInnes/aitool-cli"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="aitool"

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  darwin) PLATFORM="darwin" ;;
  linux)  PLATFORM="linux" ;;
  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64)          ARCH="x64" ;;
  aarch64 | arm64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

TARGET="${PLATFORM}-${ARCH}"

# Fetch latest release tag
echo "Fetching latest release..."
VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' \
  | head -1 \
  | cut -d'"' -f4)"

if [ -z "$VERSION" ]; then
  echo "Failed to determine latest version." >&2
  exit 1
fi

echo "Installing aitool ${VERSION} (${TARGET})..."

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/aitool-${TARGET}"
TMP_FILE="$(mktemp)"

curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE"
chmod +x "$TMP_FILE"

# Install (may require sudo depending on target dir)
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
else
  echo "Installing to ${INSTALL_DIR} requires elevated privileges."
  sudo mv "$TMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo "Installed: $(which ${BINARY_NAME})"
echo "Run: ${BINARY_NAME}"
