import clsx from 'clsx';

/**
 * UI-кіт нового кабінету.
 *
 * Головна відмінність від старого `components/ui.tsx`: тут для кожного блоку
 * передбачені стани empty / loading / error / disconnected. Правило з ТЗ
 * (вкладка «AI — дизайн»): екран проєктується не лише під happy path.
 *
 * Усі компоненти — серверні (без хуків), щоб їх можна було рендерити
 * прямо зі сторінок-серверних компонентів.
 */

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {description && (
          <p className="text-slate-500 mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function Card({
  title,
  hint,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        'bg-white rounded-xl border border-slate-200 p-5',
        className,
      )}
    >
      {title && (
        <header className="mb-4">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold mt-1 text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-2">{hint}</p>}
    </div>
  );
}

type Tone = 'ok' | 'warn' | 'error' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Даних ще немає — і це нормальний стан, а не помилка. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4">
      <p className="font-medium text-slate-700">{title}</p>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Використовується як `loading.tsx` або всередині Suspense. */
export function LoadingState({ label = 'Завантаження…' }: { label?: string }) {
  return (
    <div className="py-10 text-center text-sm text-slate-500" role="status">
      {label}
    </div>
  );
}

/**
 * Помилка показується людською мовою. Технічний текст (`detail`) —
 * другим рівнем, щоб не лякати користувача HTTP-кодами.
 */
export function ErrorState({
  title = 'Не вдалося завантажити дані',
  description,
  detail,
}: {
  title?: string;
  description?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="font-medium text-red-800">{title}</p>
      {description && <p className="text-sm text-red-700 mt-1">{description}</p>}
      {detail && (
        <p className="text-xs text-red-500 mt-2 font-mono break-all">{detail}</p>
      )}
    </div>
  );
}

/** Канал/інтеграція відключені — окремий стан, не помилка і не порожньо. */
export function DisconnectedState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="font-medium text-amber-800">{title}</p>
      {description && (
        <p className="text-sm text-amber-700 mt-1">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * Заглушка модуля на час каркаса.
 *
 * Свідомо показує, що саме тут буде і які API вже готові — щоб наступний
 * розробник не шукав це по документації. Прибирається разом із реалізацією
 * розділу.
 */
export function ModulePlaceholder({
  summary,
  planned,
}: {
  summary: string;
  planned: Array<{ id: string; title: string; api?: string; ready?: boolean }>;
}) {
  return (
    <Card>
      <p className="text-sm text-slate-600">{summary}</p>

      <ul className="mt-4 divide-y divide-slate-100">
        {/* Один ID може зустрічатися двічі (напр. S1-05 — і статус, і архівація),
            тому ключ доповнюємо індексом: сам по собі id не унікальний. */}
        {planned.map((item, index) => (
          <li
            key={`${item.id}-${index}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
          >
            <code className="text-xs text-slate-400 w-14 shrink-0">
              {item.id}
            </code>
            <span className="text-sm text-slate-700 flex-1 min-w-0">
              {item.title}
            </span>
            {item.api && (
              <code className="text-xs text-slate-500 font-mono">
                {item.api}
              </code>
            )}
            <Badge tone={item.ready ? 'ok' : 'neutral'}>
              {item.ready ? 'API готовий' : 'потрібна розробка'}
            </Badge>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-400 mt-4">
        Це каркас розділу. Функціонал додається поетапно — див.
        docs/new-dashboard/MVP_TECHNICAL_PLAN.md
      </p>
    </Card>
  );
}
