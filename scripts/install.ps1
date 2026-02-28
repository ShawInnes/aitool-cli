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

$Arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
$AssetName = switch ($Arch) {
    'X64'   { 'aitool-win-x64.exe' }
    'Arm64' { 'aitool-win-arm64.exe' }
    default { throw "Unsupported architecture: $Arch" }
}

# ── Fetch latest release tag ──────────────────────────────────────────────────

Write-Host "Fetching latest release..."
$ApiUrl  = "https://api.github.com/repos/$Repo/releases/latest"
$Headers = @{ 'User-Agent' = $BinaryName }

$Release = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers
$Latest  = $Release.tag_name

if (-not $Latest) { throw "Failed to determine latest version." }
Write-Host "Latest version: $Latest"

$DownloadUrl  = "https://github.com/$Repo/releases/download/$Latest/$AssetName"
$ChecksumUrl  = "https://github.com/$Repo/releases/download/$Latest/checksums.txt"

# ── Download binary ───────────────────────────────────────────────────────────

$TmpFile = [System.IO.Path]::GetTempFileName() + '.exe'
try {
    Write-Host "Downloading $AssetName..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TmpFile -Headers $Headers

    # ── Verify checksum ───────────────────────────────────────────────────────

    try {
        $Checksums = Invoke-RestMethod -Uri $ChecksumUrl -Headers $Headers
        $Line      = $Checksums -split "`n" | Where-Object { $_ -match [regex]::Escape($AssetName) } | Select-Object -First 1
        $Expected  = ($Line -split '\s+')[0].Trim()

        if ($Expected) {
            $Actual = (Get-FileHash -Path $TmpFile -Algorithm SHA256).Hash.ToLower()
            if ($Actual -ne $Expected) {
                throw "Checksum mismatch!`n  Expected: $Expected`n  Got:      $Actual"
            }
            Write-Host "Checksum verified."
        } else {
            Write-Warning "No checksum found for $AssetName, skipping verification."
        }
    } catch [System.Net.WebException] {
        Write-Warning "Could not fetch checksums, skipping verification."
    }

    # ── Install ───────────────────────────────────────────────────────────────

    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    $Dest = Join-Path $InstallDir "$BinaryName.exe"
    Move-Item -Path $TmpFile -Destination $Dest -Force

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
    if (Test-Path $TmpFile) { Remove-Item $TmpFile -Force -ErrorAction SilentlyContinue }
}
