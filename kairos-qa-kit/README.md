# Kairos QA Kit

Универсальный внутренний QA-конвейер для проектов в Cursor.

Версия: **1.0.0**  
Дата: **2026-07-15**

## Что делает пакет

После установки в проект появляется единый процесс:

```text
Cursor реализует задачу
        ↓
автоматические проверки
        ↓
QA Tester ищет воспроизводимые баги
        ↓
Cursor исправляет подтверждённые баги
        ↓
QA Tester проверяет повторно
        ↓
Release Auditor независимо принимает работу
        ↓
владелец получает RELEASE_REPORT.md
```

Главный принцип: разработчик, тестировщик и финальный аудитор имеют разные роли.  
QA Tester и Release Auditor не должны исправлять рабочий код.

## Быстрый старт на macOS / Linux

Распакуйте архив и откройте Terminal в папке `kairos-qa-kit`.

Установка в один проект:

```bash
chmod +x install.sh install-many.sh
./install.sh "/полный/путь/к/проекту"
```

Установка сразу во все проекты внутри одной папки:

```bash
./install-many.sh "/полный/путь/к/папке/с/проектами"
```

Установщик не перезаписывает существующие файлы. Для принудительного обновления:

```bash
./install.sh --force "/полный/путь/к/проекту"
```

## Быстрый старт на Windows PowerShell

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1 -Target "C:\Projects\MyProject"
```

Для замены файлов пакета:

```powershell
.\install.ps1 -Target "C:\Projects\MyProject" -Force
```

## После установки

Один раз заполните:

```text
.qa/PROJECT.md
.qa/ACCEPTANCE.md
.qa/TEST_SCENARIOS.md
.qa/CHECKS.conf
```

Для новой задачи:

```bash
./scripts/new-qa-task.sh "Краткое название задачи"
```

Затем заполните `.qa/CURRENT_TASK.md` и напишите Cursor:

```text
Выполни задачу из .qa/CURRENT_TASK.md.
После реализации запусти полный Kairos QA Pipeline.
Не останавливайся после написания кода: проверки → QA → исправления → повторный QA → Release Auditor.
```

## Что вставить в глобальные User Rules Cursor

Откройте файл:

```text
GLOBAL_USER_RULE.txt
```

Скопируйте его содержимое в глобальные User Rules Cursor один раз.  
Проектное правило также устанавливается в `.cursor/rules/kairos-qa-pipeline.mdc`.

## Основные файлы в проекте

```text
.cursor/
├── agents/
│   ├── qa-tester.md
│   └── release-auditor.md
└── rules/
    └── kairos-qa-pipeline.mdc

.qa/
├── PROJECT.md
├── CURRENT_TASK.md
├── ACCEPTANCE.md
├── TEST_SCENARIOS.md
├── CHECKS.conf
├── BUGS.md
├── QA_REPORT.md
├── RELEASE_REPORT.md
├── DECISIONS.md
├── STATE.md
└── logs/

scripts/
├── new-qa-task.sh
├── run-checks.sh
├── qa-doctor.sh
└── qa-status.sh
```

## Команды

Проверить установку:

```bash
./scripts/qa-doctor.sh
```

Запустить технические проверки вручную:

```bash
./scripts/run-checks.sh
```

Посмотреть краткий статус:

```bash
./scripts/qa-status.sh
```

Создать новую задачу и архивировать старые отчёты:

```bash
./scripts/new-qa-task.sh "Экспорт отчёта в PDF"
```

## Критичность багов

- `P0 BLOCKER` — потеря данных, серьёзная уязвимость, продукт не запускается, критическая бизнес-функция полностью недоступна.
- `P1 CRITICAL` — основной сценарий сломан, неверные финансовые/аналитические данные, обход авторизации.
- `P2 MAJOR` — важная функция работает неправильно, но существует обходной путь.
- `P3 MINOR` — косметика, текст, небольшое неудобство; выпуск обычно не блокирует.

## Когда цикл останавливается

Конвейер допускает максимум три цикла исправлений. После этого статус:

```text
HUMAN_DECISION_REQUIRED
```

Выпуск разрешён, когда:

```text
Checks: PASS
P0: 0
P1: 0
P2: 0
QA: PASS
Release Auditor: PASS
```

`P3` фиксируются отдельно и не обязаны блокировать выпуск.

## Важное ограничение первой версии

Пакет стандартизирует работу Cursor и его подагентов, отчёты и локальные проверки. Он не подключает внешние OpenAI/Claude API и не гарантирует полностью автономную работу без разрешений Cursor. Внешнего независимого судью можно подключить следующим этапом, не меняя структуру `.qa`.
