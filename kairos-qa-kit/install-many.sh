#!/usr/bin/env bash
set -euo pipefail

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=""
ROOT="${1:-}"

if [[ "${1:-}" == "--force" ]]; then
  FORCE="--force"
  shift
  ROOT="${1:-}"
fi

if [[ -z "$ROOT" || ! -d "$ROOT" ]]; then
  echo "Использование:"
  echo "  ./install-many.sh /path/to/projects"
  echo "  ./install-many.sh --force /path/to/projects"
  exit 1
fi

ROOT="$(cd "$ROOT" && pwd)"
count=0

for project in "$ROOT"/*; do
  [[ -d "$project" ]] || continue

  if [[ -d "$project/.git" || -f "$project/package.json" || -f "$project/composer.json" || -f "$project/pyproject.toml" || -f "$project/wp-config.php" ]]; then
    echo
    echo "============================================================"
    echo "Project: $project"
    echo "============================================================"
    "$KIT/install.sh" $FORCE "$project"
    count=$((count+1))
  fi
done

echo
echo "Установлено проектов: $count"
if [[ $count -eq 0 ]]; then
  echo "Подходящие проекты не найдены. Устанавливайте по одному через install.sh."
fi
