#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

required=(
  ".cursor/rules/kairos-qa-pipeline.mdc"
  ".cursor/agents/qa-tester.md"
  ".cursor/agents/release-auditor.md"
  ".qa/PROJECT.md"
  ".qa/CURRENT_TASK.md"
  ".qa/ACCEPTANCE.md"
  ".qa/TEST_SCENARIOS.md"
  ".qa/CHECKS.conf"
  ".qa/BUGS.md"
  ".qa/QA_REPORT.md"
  ".qa/RELEASE_REPORT.md"
  ".qa/DECISIONS.md"
  ".qa/STATE.md"
  "scripts/run-checks.sh"
)

failed=0
echo "Kairos QA Doctor"
echo "Project: $ROOT"
echo

for file in "${required[@]}"; do
  if [[ -f "$file" ]]; then
    echo "PASS  $file"
  else
    echo "FAIL  $file"
    failed=$((failed+1))
  fi
done

echo
if command -v git >/dev/null 2>&1; then
  echo "PASS  git available"
else
  echo "WARN  git not found"
fi

if [[ -f package.json ]]; then
  command -v node >/dev/null 2>&1 && echo "PASS  node available" || echo "WARN  package.json exists, node not found"
fi

if [[ -f composer.json ]]; then
  command -v composer >/dev/null 2>&1 && echo "PASS  composer available" || echo "WARN  composer.json exists, composer not found"
fi

if [[ $failed -eq 0 ]]; then
  echo
  echo "QA kit installed correctly."
  exit 0
else
  echo
  echo "Missing files: $failed"
  exit 1
fi
