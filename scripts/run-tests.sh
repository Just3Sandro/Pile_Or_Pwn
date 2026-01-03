#!/usr/bin/env bash
set -euo pipefail

# Run project build (if Makefile present) then unit tests.
if [ -f Makefile ]; then
  echo "Running make..."
  make
else
  echo "No Makefile present; skipping make"
fi

echo "Running npm test..."
npm test
