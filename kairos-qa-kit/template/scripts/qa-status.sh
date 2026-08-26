#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QA="$ROOT/.qa"

extract() {
  local file="$1"
  local pattern="$2"
  if [[ -f "$file" ]]; then
    grep -E "$pattern" "$file" | tail -n 1 || true
  fi
}

echo "Kairos QA Status"
echo "Project: $ROOT"
echo
extract "$QA/LAST_CHECKS.md" '^CHECKS_VERDICT:'
extract "$QA/QA_REPORT.md" '^QA_VERDICT:'
extract "$QA/QA_REPORT.md" '^OPEN_P[0-3]:'
extract "$QA/RELEASE_REPORT.md" '^RELEASE_VERDICT:'
echo
echo "Reports:"
echo "- .qa/LAST_CHECKS.md"
echo "- .qa/QA_REPORT.md"
echo "- .qa/RELEASE_REPORT.md"
