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
    <div className="v2-page-header -mx-4 mb-6 bg-[#073aa8] px-4 pb-7 pt-6 text-white sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 lg:pb-9 lg:pt-8">
      <div className="mx-auto flex max-w-[1536px] flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200">ClearTG Analytics</p>
          <h1 className="text-3xl font-extrabold tracking-[-0.035em] text-white sm:text-4xl lg:text-[42px] lg:leading-none">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100 sm:text-base">{description}</p>
          )}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
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
        'bg-white rounded-[18px] border border-[#dbe4f0] p-4 shadow-[0_10px_34px_rgba(20,52,110,0.055)] sm:p-5',
        className,
      )}
    >
      {title && (
        <header className="mb-4">
          <h2 className="text-base font-bold tracking-[-0.01em] text-[#102044] sm:text-lg">{title}</h2>
          {hint && <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{hint}</p>}
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
    <div className="min-w-0 bg-white px-4 py-4 sm:px-5">
      <p className="text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-[-0.035em] text-[#102044] sm:text-3xl">{value}</p>
      {hint && <p className="mt-2 text-[11px] leading-4 text-slate-400">{hint}</p>}
    </div>
  );
}

type Tone = 'ok' | 'warn' | 'error' | 'neutral';

const TONE_CLASSES: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
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
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none',
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
    <div className="rounded-[18px] border border-dashed border-slate-300 bg-white/70 px-4 py-12 text-center">
      <p className="font-bold text-[#102044]">{title}</p>
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
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
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
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
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
