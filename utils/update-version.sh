#!/bin/bash
# Get the version from config.js
VERSION=$(grep 'VERSION:' src/config.js | cut -d'"' -f2)
# Update sw.js using sed (in-place)
sed -i "s|// VERSION: .*|// VERSION: $VERSION|" sw.js
