#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QA="$ROOT/.qa"
NAME="${1:-}"

if [[ -z "$NAME" ]]; then
  echo "Использование: ./scripts/new-qa-task.sh \"Название задачи\""
  exit 1
fi

mkdir -p "$QA/archive" "$QA/logs"
STAMP="$(date +%Y%m%d-%H%M%S)"

for f in BUGS.md QA_REPORT.md RELEASE_REPORT.md LAST_CHECKS.md; do
  if [[ -f "$QA/$f" ]]; then
    cp "$QA/$f" "$QA/archive/${STAMP}-${f}"
  fi
done

DATE="$(date +%Y-%m-%d)"

cat > "$QA/CURRENT_TASK.md" <<EOF
# Current Task

- Название: $NAME
- Дата: $DATE
- Владелец:
- Статус: READY

## Проблема

ЗАПОЛНИТЬ.

## Требуемый результат

ЗАПОЛНИТЬ.

## Scope

Разрешено изменить:

-

## Out of scope

Не делать:

-

## Acceptance criteria

- [ ]
- [ ]
- [ ]

## Риски

- Данные:
- Авторизация:
- Платежи:
- Совместимость:
- Производительность:

## Материалы

-

## Команда запуска полного цикла

\`\`\`text
Выполни задачу из .qa/CURRENT_TASK.md и запусти полный Kairos QA Pipeline.
\`\`\`
EOF

cat > "$QA/BUGS.md" <<'EOF'
# Confirmed Bugs

Открытых подтверждённых багов нет.
EOF

cat > "$QA/QA_REPORT.md" <<EOF
# QA Report

- Date: $DATE
- Task: $NAME
- Cycle: 0
- Environment:
- Build: NOT_RUN
- Automated checks: NOT_RUN
- Scenarios checked:

## Confirmed defects

Нет.

## Unverified observations

Нет.

## Evidence

-

QA_VERDICT: NOT_RUN
OPEN_P0: 0
OPEN_P1: 0
OPEN_P2: 0
OPEN_P3: 0
EOF

cat > "$QA/RELEASE_REPORT.md" <<EOF
# Release Report

- Verdict: NOT_RUN
- Date: $DATE
- Task: $NAME
- Commit / working tree:
- Technical checks: NOT_RUN
- QA verdict: NOT_RUN
- Acceptance criteria: NOT_RUN
- Independent scenarios:
- Open P0/P1/P2:
- Open P3:

## Evidence reviewed

-

## Independent findings

-

## Residual risks

-

## Owner manual check

1.
2.
3.

## Final reason

Финальный аудит ещё не запускался.

RELEASE_VERDICT: NOT_RUN
EOF

cat > "$QA/STATE.md" <<'EOF'
# QA State

- Status: TASK_READY
- Current cycle: 0
- Maximum cycles: 3
- Last checks: NOT_RUN
- QA verdict: NOT_RUN
- Release verdict: NOT_RUN
- Human decision required: NO
EOF

echo "Создана задача: $NAME"
echo "Заполните: .qa/CURRENT_TASK.md"
