# Dynatrace App Deploy Script (Windows)
$RepoUrl = "https://github.com/YOUR_ORG/YOUR_REPO"  # <-- update this
$ErrorActionPreference = "Stop"

Write-Host "=== Dynatrace App Deploy ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Node.js ───────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js not found. Installing via winget..."
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    # refresh PATH so node is available immediately
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}
Write-Host "Node.js: $(node --version)"

# ── 2. Get the project ───────────────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# If this script is already inside the project, skip cloning
$IsInsideProject = Test-Path (Join-Path $ScriptDir "package.json")
if ($IsInsideProject -and (Select-String -Path (Join-Path $ScriptDir "package.json") -Pattern "dt-app" -Quiet)) {
    $ProjectDir = $ScriptDir
    Write-Host "Using existing project at $ProjectDir"
} else {
    $ProjectDir = Join-Path $env:USERPROFILE "monthly-review-dashboard"
    if (Test-Path (Join-Path $ProjectDir ".git")) {
        Write-Host "Updating existing repo..."
        git -C $ProjectDir pull
    } else {
        if (Get-Command git -ErrorAction SilentlyContinue) {
            Write-Host "Cloning repo..."
            git clone $RepoUrl $ProjectDir
        } else {
            Write-Host "Git not found. Installing via winget..."
            winget install Git.Git --accept-package-agreements --accept-source-agreements
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                        [System.Environment]::GetEnvironmentVariable("Path", "User")
            git clone $RepoUrl $ProjectDir
        }
    }
}

Set-Location $ProjectDir

# ── 3. Install dependencies ──────────────────────────────────────────────────
Write-Host ""
Write-Host "Installing dependencies..."
npm install --silent

# ── 4. Ensure app.config.json exists ─────────────────────────────────────────
# app.config.json is gitignored (holds a tenant URL). Create it from the
# committed template on first run — no manual renaming needed.
if (-not (Test-Path "app.config.json")) {
    Write-Host "Creating app.config.json from template..."
    Copy-Item "app.config.example.json" "app.config.json"
}

# ── 5. Target environment ────────────────────────────────────────────────────
Write-Host ""
$EnvUrl = Read-Host "Enter the target Dynatrace environment URL (e.g. https://abc12345.live.dynatrace.com/)"

if ([string]::IsNullOrWhiteSpace($EnvUrl)) {
    Write-Error "Environment URL is required."
    exit 1
}

# ensure trailing slash
if (-not $EnvUrl.EndsWith("/")) { $EnvUrl = $EnvUrl + "/" }

# update app.config.json
$config = Get-Content "app.config.json" -Raw | ConvertFrom-Json
$config.environmentUrl = $EnvUrl
$config | ConvertTo-Json -Depth 10 | Set-Content "app.config.json" -Encoding UTF8
Write-Host "Updated environmentUrl to $EnvUrl"

# ── 5. Authenticate ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Opening browser for Dynatrace authentication..." -ForegroundColor Yellow
Write-Host "(Log in with the account that has app deployment permissions on the target environment)"
Write-Host ""
npx dt-app auth

# ── 6. Deploy ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Deploying app..."
npm run deploy

Write-Host ""
Write-Host "Done! App deployed to $EnvUrl" -ForegroundColor Green
