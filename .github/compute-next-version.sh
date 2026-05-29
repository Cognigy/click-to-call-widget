#!/usr/bin/env bash
# Prints the next release version (patch bump, no 'v' prefix), chosen as the
# highest of: existing git tags (leading 'v' optional) and the package.json
# version, with the patch component incremented by one.
set -euo pipefail

pkg_version="$(node -p "require('./package.json').version")"

existing_tags="$(git tag --list | sed 's/^v//' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' || true)"

base="$(printf '%s\n%s\n' "$pkg_version" "$existing_tags" \
  | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' \
  | sort -V \
  | tail -n 1)"

IFS='.' read -r major minor patch <<< "$base"
echo "${major}.${minor}.$((patch + 1))"
