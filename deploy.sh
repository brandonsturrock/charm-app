#!/bin/bash
set -e

REPO_URL="https://github.com/YOUR_ORG/YOUR_REPO"  # <-- update this

echo "=== Dynatrace App Deploy ==="
echo ""

# ── 1. Node.js ───────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Node.js not found. Installing via Homebrew..."
  if ! command -v brew &>/dev/null; then
    echo "Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # add brew to PATH for Apple Silicon
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null || true
  fi
  brew install node
fi
echo "Node.js: $(node --version)"

# ── 2. Get the project ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# If this script is already inside the project directory, skip cloning
if [ -f "$SCRIPT_DIR/package.json" ] && grep -q "dt-app" "$SCRIPT_DIR/package.json" 2>/dev/null; then
  PROJECT_DIR="$SCRIPT_DIR"
  echo "Using existing project at $PROJECT_DIR"
else
  PROJECT_DIR="$HOME/monthly-review-dashboard"
  if [ -d "$PROJECT_DIR/.git" ]; then
    echo "Updating existing repo..."
    git -C "$PROJECT_DIR" pull
  else
    if command -v git &>/dev/null; then
      echo "Cloning repo..."
      git clone "$REPO_URL" "$PROJECT_DIR"
    else
      echo "Git not found. Installing via Homebrew..."
      brew install git
      git clone "$REPO_URL" "$PROJECT_DIR"
    fi
  fi
fi

cd "$PROJECT_DIR"

# ── 3. Install dependencies ──────────────────────────────────────────────────
echo ""
echo "Installing dependencies..."
npm install --silent

# ── 4. Ensure app.config.json exists ─────────────────────────────────────────
# app.config.json is gitignored (holds a tenant URL). Create it from the
# committed template on first run — no manual renaming needed.
if [ ! -f "app.config.json" ]; then
  echo "Creating app.config.json from template..."
  cp app.config.example.json app.config.json
fi

# ── 5. Target environment ────────────────────────────────────────────────────
echo ""
read -p "Enter the target Dynatrace environment URL (e.g. https://abc12345.live.dynatrace.com/): " ENV_URL

if [ -z "$ENV_URL" ]; then
  echo "Error: environment URL is required."
  exit 1
fi

# strip trailing slash
ENV_URL="${ENV_URL%/}/"

# update app.config.json
node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync('app.config.json', 'utf8'));
  cfg.environmentUrl = '$ENV_URL';
  fs.writeFileSync('app.config.json', JSON.stringify(cfg, null, 2) + '\n');
  console.log('Updated environmentUrl to $ENV_URL');
"

# ── 5. Authenticate ──────────────────────────────────────────────────────────
echo ""
echo "Opening browser for Dynatrace authentication..."
echo "(Log in with the account that has app deployment permissions on the target environment)"
echo ""
npx dt-app auth

# ── 6. Deploy ────────────────────────────────────────────────────────────────
echo ""
echo "Deploying app..."
npm run deploy

echo ""
echo "Done! App deployed to $ENV_URL"
