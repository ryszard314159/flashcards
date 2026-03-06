#!/bin/bash

# 1. Get current date in YYYY-MM-DD format
NEW_VERSION=$(date +%Y-%m-%d.%H%M)

# 2. Update src/config.js
# Looks for VERSION: "old-version", and replaces it with the new date
sed -i "s/VERSION: \".*\"/VERSION: \"$NEW_VERSION\"/" src/config.js

# 3. Update sw.js
# Looks for // VERSION: old-version and replaces it with the new date
sed -i "s|// VERSION: .*|// VERSION: $NEW_VERSION|" sw.js

echo "Updated version to $NEW_VERSION in both src/config.js and sw.js"