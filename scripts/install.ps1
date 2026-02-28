# install.ps1 - Install or update aitool from GitHub Releases
# Usage: irm https://raw.githubusercontent.com/ShawInnes/aitool-cli/main/scripts/install.ps1 | iex
#        $env:INSTALL_DIR = "$env:LOCALAPPDATA\Programs\aitool"; irm ... | iex
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'

$Repo       = 'ShawInnes/aitool-cli'
$BinaryName = 'aitool'
$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { "$env:LOCALAPPDATA\Programs\aitool" }

# ── Platform detection ────────────────────────────────────────────────────────

$Arch = $env:PROCESSOR_ARCHITECTURE
$AssetBase, $ExeName = switch ($Arch) {
    'AMD64' { 'aitool-win-x64',   'aitool-win-x64.exe' }
    'ARM64' { 'aitool-win-arm64', 'aitool-win-arm64.exe' }
    default { throw "Unsupported architecture: $Arch" }
}
$ArchiveName = "$AssetBase.zip"

# ── Fetch latest release tag ──────────────────────────────────────────────────

Write-Host "Fetching latest release..."
$ApiUrl  = "https://api.github.com/repos/$Repo/releases/latest"
$Headers = @{ 'User-Agent' = $BinaryName }

$Release = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers
$Latest  = $Release.tag_name

if (-not $Latest) { throw "Failed to determine latest version." }
Write-Host "Latest version: $Latest"

$DownloadUrl = "https://github.com/$Repo/releases/download/$Latest/$ArchiveName"
$ChecksumUrl = "https://github.com/$Repo/releases/download/$Latest/checksums.txt"

# ── Download archive ──────────────────────────────────────────────────────────

$TmpDir  = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
$TmpZip  = Join-Path $TmpDir $ArchiveName

try {
    Write-Host "Downloading $ArchiveName..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TmpZip -Headers $Headers

    # ── Verify checksum ───────────────────────────────────────────────────────

    try {
        $Checksums = Invoke-RestMethod -Uri $ChecksumUrl -Headers $Headers
        $Line      = $Checksums -split "`n" | Where-Object { $_ -match [regex]::Escape($ArchiveName) } | Select-Object -First 1
        $Expected  = ($Line -split '\s+')[0].Trim()

        if ($Expected) {
            $Actual = (Get-FileHash -Path $TmpZip -Algorithm SHA256).Hash.ToLower()
            if ($Actual -ne $Expected) {
                throw "Checksum mismatch!`n  Expected: $Expected`n  Got:      $Actual"
            }
            Write-Host "Checksum verified."
        } else {
            Write-Warning "No checksum found for $ArchiveName, skipping verification."
        }
    } catch [System.Net.WebException] {
        Write-Warning "Could not fetch checksums, skipping verification."
    }

    # ── Extract and install ───────────────────────────────────────────────────

    Expand-Archive -Path $TmpZip -DestinationPath $TmpDir -Force

    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $Dest = Join-Path $InstallDir "$BinaryName.exe"
    Move-Item -Path (Join-Path $TmpDir $ExeName) -Destination $Dest -Force

    Write-Host ""
    Write-Host "Installed $BinaryName $Latest -> $Dest"

    # Add to PATH for current user if not already present
    $UserPath = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
    if ($UserPath -notlike "*$InstallDir*") {
        [System.Environment]::SetEnvironmentVariable('PATH', "$UserPath;$InstallDir", 'User')
        Write-Host "Added $InstallDir to your PATH (restart your terminal to take effect)."
    }

    Write-Host "Run '$BinaryName --help' to get started."
} finally {
    Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
