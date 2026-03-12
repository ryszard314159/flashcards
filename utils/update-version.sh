#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"
echo REPO_ROOT=$REPO_ROOT

VERSION=$(date +%Y-%m-%d.%H%M)

# Update src/config.js
sed -i "s/VERSION: \".*\"/VERSION: \"$VERSION\"/" src/config.js

# update sw.js: const VERSION = "YYYY-MM-DD.HHMM"
sed -i "s|const VERSION = .*|const VERSION = \"$VERSION\";|" sw.js

echo "Updated version to $VERSION in src/config.js and sw.js"