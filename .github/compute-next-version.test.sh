#!/usr/bin/env bash
# Unit tests for compute-next-version.sh using throwaway git repos.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/compute-next-version.sh"
failures=0

run_case() {
  local name="$1" pkg_version="$2" tags="$3" expected="$4"
  local dir
  dir="$(mktemp -d)"
  (
    cd "$dir"
    git init -q
    git config user.email t@t.t
    git config user.name t
    echo "{\"version\": \"$pkg_version\"}" > package.json
    git add package.json
    git commit -qm init
    for t in $tags; do git tag "$t"; done
    actual="$(bash "$SCRIPT")"
    if [ "$actual" != "$expected" ]; then
      echo "FAIL [$name]: expected $expected, got $actual"
      exit 1
    fi
    echo "PASS [$name]: $actual"
  ) || failures=$((failures + 1))
  rm -rf "$dir"
}

run_case "no tags, pkg 0.0.1"                "0.0.1" ""               "0.0.2"
run_case "tag 0.0.1 (no prefix)"             "0.0.1" "0.0.1"          "0.0.2"
run_case "v-prefixed tags"                   "0.0.1" "v0.0.1 v0.0.2"  "0.0.3"
run_case "tag higher than pkg"               "0.0.1" "v0.1.5"         "0.1.6"
run_case "pkg higher than tags"              "0.2.0" "v0.1.9"         "0.2.1"
run_case "double-digit patch sorts numerically" "0.0.1" "v0.0.2 v0.0.10" "0.0.11"

if [ "$failures" -ne 0 ]; then
  echo "$failures case(s) failed"
  exit 1
fi
echo "All cases passed"
