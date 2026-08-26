#!/usr/bin/env bash
set -euo pipefail

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$KIT/template"
FORCE=0

if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
  shift
fi

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Использование:"
  echo "  ./install.sh /path/to/project"
  echo "  ./install.sh --force /path/to/project"
  exit 1
fi

if [[ ! -d "$TARGET" ]]; then
  echo "Папка не найдена: $TARGET"
  exit 1
fi

TARGET="$(cd "$TARGET" && pwd)"

copy_file() {
  local src="$1"
  local rel="${src#$TEMPLATE/}"
  local dst="$TARGET/$rel"

  mkdir -p "$(dirname "$dst")"

  if [[ -e "$dst" && $FORCE -ne 1 ]]; then
    echo "SKIP  $rel"
    return
  fi

  cp "$src" "$dst"
  echo "COPY  $rel"
}

while IFS= read -r -d '' file; do
  copy_file "$file"
done < <(find "$TEMPLATE" -type f -print0)

chmod +x "$TARGET"/scripts/*.sh 2>/dev/null || true

echo
echo "Kairos QA Kit установлен:"
echo "$TARGET"
echo
echo "Следующие шаги:"
echo "1. Заполнить .qa/PROJECT.md"
echo "2. Заполнить .qa/ACCEPTANCE.md и .qa/TEST_SCENARIOS.md"
echo "3. Настроить .qa/CHECKS.conf или оставить автоопределение"
echo "4. Запустить ./scripts/qa-doctor.sh"
