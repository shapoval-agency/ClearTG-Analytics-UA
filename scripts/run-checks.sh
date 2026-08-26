#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QA="$ROOT/.qa"
LOGS="$QA/logs"
CONF="$QA/CHECKS.conf"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$LOGS/checks-$STAMP.log"
SUMMARY="$QA/LAST_CHECKS.md"

mkdir -p "$LOGS"
cd "$ROOT"

commands=()
labels=()

add_command() {
  labels+=("$1")
  commands+=("$2")
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

# Пользовательские команды имеют приоритет.
if [[ -f "$CONF" ]]; then
  while IFS= read -r raw || [[ -n "$raw" ]]; do
    line="$(trim "$raw")"
    [[ -z "$line" || "$line" == \#* ]] && continue
    add_command "Configured check" "$line"
  done < "$CONF"
fi

has_npm_script() {
  local script="$1"
  command -v node >/dev/null 2>&1 || return 1
  [[ -f package.json ]] || return 1
  node -e '
    const fs=require("fs");
    const p=JSON.parse(fs.readFileSync("package.json","utf8"));
    process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1);
  ' "$script"
}

package_runner() {
  if [[ -f pnpm-lock.yaml ]] && command -v pnpm >/dev/null 2>&1; then
    echo "pnpm"
  elif [[ -f yarn.lock ]] && command -v yarn >/dev/null 2>&1; then
    echo "yarn"
  else
    echo "npm"
  fi
}

# Автоопределение, если CHECKS.conf пуст.
if [[ ${#commands[@]} -eq 0 && -f package.json ]]; then
  RUNNER="$(package_runner)"
  if has_npm_script lint; then add_command "Node lint" "$RUNNER run lint"; fi
  if has_npm_script typecheck; then add_command "Node typecheck" "$RUNNER run typecheck"; fi
  if has_npm_script test; then add_command "Node tests" "CI=1 $RUNNER run test"; fi
  if has_npm_script build; then add_command "Node build" "$RUNNER run build"; fi
fi

if [[ ${#commands[@]} -eq 0 && -f composer.json ]] && command -v composer >/dev/null 2>&1; then
  add_command "Composer validate" "composer validate --no-interaction --no-check-publish"
  if composer run-script --list 2>/dev/null | grep -Eq '(^|[[:space:]])test([[:space:]]|$)'; then
    add_command "Composer tests" "composer test"
  fi
fi

if [[ ${#commands[@]} -eq 0 && ( -f pyproject.toml || -f requirements.txt ) ]]; then
  if command -v ruff >/dev/null 2>&1; then add_command "Python lint" "ruff check ."; fi
  if command -v pytest >/dev/null 2>&1; then add_command "Python tests" "pytest -q"; fi
fi

{
  echo "# Kairos Technical Checks"
  echo
  echo "- Date: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "- Root: $ROOT"
  echo "- Log: .qa/logs/$(basename "$LOG")"
  echo
} > "$SUMMARY"

if [[ ${#commands[@]} -eq 0 ]]; then
  {
    echo "Не найдено ни одной команды проверки."
    echo "Заполните .qa/CHECKS.conf: одна команда на строку."
  } | tee "$LOG"
  {
    echo "- Overall: BLOCKED"
    echo "- Reason: no checks configured"
    echo
    echo "CHECKS_VERDICT: BLOCKED"
  } >> "$SUMMARY"
  exit 2
fi

passed=0
failed=0

for i in "${!commands[@]}"; do
  label="${labels[$i]}"
  cmd="${commands[$i]}"
  {
    echo
    echo "============================================================"
    echo "[$((i+1))/${#commands[@]}] $label"
    echo "\$ $cmd"
    echo "============================================================"
  } | tee -a "$LOG"

  started="$(date +%s)"
  bash -lc "$cmd" 2>&1 | tee -a "$LOG"
  status=${PIPESTATUS[0]}
  elapsed=$(( $(date +%s) - started ))

  if [[ $status -eq 0 ]]; then
    result="PASS"
    passed=$((passed+1))
  else
    result="FAIL"
    failed=$((failed+1))
  fi

  printf -- "- %s: **%s** (%ss) — `%s`\n" "$label" "$result" "$elapsed" "$cmd" >> "$SUMMARY"
done

{
  echo
  echo "## Totals"
  echo
  echo "- Passed: $passed"
  echo "- Failed: $failed"
} >> "$SUMMARY"

if [[ $failed -eq 0 ]]; then
  echo "CHECKS_VERDICT: PASS" >> "$SUMMARY"
  echo "Все технические проверки прошли."
  exit 0
else
  echo "CHECKS_VERDICT: FAIL" >> "$SUMMARY"
  echo "Есть провалившиеся технические проверки."
  exit 1
fi
