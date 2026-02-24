# install.ps1 - PowerShell installer for aitool-cli on Windows
#
# Usage (run in PowerShell as Administrator or adjust $InstallDir):
#   irm https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.ps1 | iex
#
# Override install directory:
#   $env:AITOOL_INSTALL_DIR = "C:\tools"; irm ... | iex

$ErrorActionPreference = 'Stop'

$Repo        = "ShawInnes/aitool-cli"
$BinaryName  = "aitool.exe"
$InstallDir  = if ($env:AITOOL_INSTALL_DIR) { $env:AITOOL_INSTALL_DIR } else { "$env:LOCALAPPDATA\aitool" }

# Only x64 Windows is supported
$Target = "win-x64"

# Fetch latest release tag
Write-Host "Fetching latest release..."
$Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
$Version = $Release.tag_name

if (-not $Version) {
    Write-Error "Failed to determine latest version."
    exit 1
}

Write-Host "Installing aitool $Version ($Target)..."

$DownloadUrl = "https://github.com/$Repo/releases/download/$Version/aitool-$Target.exe"
$TmpFile     = [System.IO.Path]::GetTempFileName() + ".exe"

Invoke-WebRequest $DownloadUrl -OutFile $TmpFile

# Create install directory if it doesn't exist
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

Move-Item -Force $TmpFile "$InstallDir\$BinaryName"

# Add to PATH for this session
$env:PATH = "$InstallDir;$env:PATH"

# Persist to user PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($CurrentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$InstallDir;$CurrentPath", "User")
    Write-Host "Added $InstallDir to user PATH (restart shell to take effect)."
}

Write-Host "Installed: $InstallDir\$BinaryName"
Write-Host "Run: aitool"
