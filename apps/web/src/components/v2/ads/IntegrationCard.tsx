'use client';

import { useState, useTransition } from 'react';
import {
  saveAdIntegrationV2Action,
  verifyAdIntegrationV2Action,
  setAdIntegrationActiveV2Action,
  sendAdTestEventV2Action,
  type AdPlatformKey,
  type IntegrationCheckResult,
} from '@/app/v2/actions';
import { Badge } from '@/components/v2/ui';

export interface IntegrationField {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  secret?: boolean;
  optional?: boolean;
}

const CHECK_TONE = { ok: 'text-emerald-700', warning: 'text-amber-700', error: 'text-red-700' } as const;
const CHECK_ICON = { ok: '✓', warning: '!', error: '✕' } as const;

/**
 * Підключення однієї рекламної системи (S3-01, S3-03, S3-05).
 *
 * Порядок дій зашитий в інтерфейс: зберегти дані → перевірити → увімкнути
 * відправку. Нові дані завжди вимикають відправку до наступної перевірки —
 * так нічого не піде в рекламний кабінет з неперевіреними доступами.
 */
export function IntegrationCard({
  platform,
  title,
  description,
  fields,
  initialValues,
  configured,
  isActive,
  extra,
  disabledReason,
}: {
  platform: AdPlatformKey;
  title: string;
  description: string;
  fields: IntegrationField[];
  initialValues: Record<string, string>;
  configured: boolean;
  isActive: boolean;
  /** Додатковий блок (наприклад, вхід через Google). */
  extra?: React.ReactNode;
  /** Чому перевірка зараз неможлива (наприклад, не виконано вхід через Google). */
  disabledReason?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initialValues);
  const [editing, setEditing] = useState(!configured);
  const [check, setCheck] = useState<IntegrationCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    setNotice(null);
    startTransition(action);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const missing = fields.find((f) => !f.optional && !values[f.name]?.trim());
    if (missing) {
      setError(`Заповніть поле «${missing.label}»`);
      return;
    }
    run(async () => {
      const res = await saveAdIntegrationV2Action(platform, values);
      if (res.error) return setError(res.error);
      setEditing(false);
      setCheck(null);
      setNotice('Збережено. Тепер натисніть «Перевірити» — після успішної перевірки можна вмикати відправку.');
      setValues((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) =>
        [k, fields.find((f) => f.name === k)?.secret ? '' : v])));
    });
  }

  function verify() {
    run(async () => {
      const res = await verifyAdIntegrationV2Action(platform);
      if (res.error) return setError(res.error);
      setCheck(res.check);
    });
  }

  function toggle(next: boolean) {
    run(async () => {
      const res = await setAdIntegrationActiveV2Action(platform, next);
      if (res.error) return setError(res.error);
      setNotice(next ? 'Відправку увімкнено.' : 'Відправку вимкнено. Події в цю систему більше не йдуть.');
    });
  }

  function testEvent() {
    run(async () => {
      const res = await sendAdTestEventV2Action(platform);
      if (res.error) return setError(res.error);
      setNotice('Тестову подію надіслано. Перевірте її в кабінеті рекламної системи.');
    });
  }

  const field = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm';

  return (
    <section className="min-w-0 rounded-[18px] border border-[#dbe4f0] bg-white p-4 shadow-[0_10px_34px_rgba(20,52,110,0.055)] sm:p-5">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#102044] sm:text-lg">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Badge tone={isActive ? 'ok' : configured ? 'warn' : 'neutral'}>
          {isActive ? 'Відправка увімкнена' : configured ? 'Не перевірено / вимкнено' : 'Не підключено'}
        </Badge>
      </header>

      {extra}

      {editing ? (
        <form onSubmit={save} className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label htmlFor={`${platform}-${f.name}`} className="mb-1 block text-sm font-bold text-[#102044]">
                {f.label} {f.optional && <span className="font-normal text-slate-400">(необов’язково)</span>}
              </label>
              <input
                id={`${platform}-${f.name}`}
                type={f.secret ? 'password' : 'text'}
                autoComplete="off"
                className={field}
                value={values[f.name] ?? ''}
                placeholder={f.secret && configured ? 'З міркувань безпеки введіть ще раз' : f.placeholder}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
              />
              {f.hint && <p className="mt-1 text-xs text-slate-500">{f.hint}</p>}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
              {pending ? 'Зберігаємо…' : 'Зберегти'}
            </button>
            {configured && (
              <button type="button" onClick={() => setEditing(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Скасувати
              </button>
            )}
          </div>
          {configured && (
            <p className="text-xs text-slate-500">Після збереження нових даних відправку буде вимкнено до наступної перевірки.</p>
          )}
        </form>
      ) : (
        <>
          <dl className="mb-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {fields.filter((f) => !f.secret && values[f.name]).map((f) => (
              <div key={f.name} className="min-w-0">
                <dt className="text-xs text-slate-400">{f.label}</dt>
                <dd className="truncate font-medium text-slate-800">{values[f.name]}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending || Boolean(disabledReason)} onClick={verify}
              className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-50">
              {pending ? 'Перевіряємо…' : 'Перевірити'}
            </button>
            {isActive ? (
              <button type="button" disabled={pending} onClick={() => toggle(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Вимкнути відправку
              </button>
            ) : (
              <button type="button" disabled={pending || Boolean(disabledReason)} onClick={() => toggle(true)}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50">
                Увімкнути відправку
              </button>
            )}
            {isActive && (
              <button type="button" disabled={pending} onClick={testEvent}
                className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Тестова подія
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)}
              className="rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700">
              Змінити дані
            </button>
          </div>
          {disabledReason && <p className="mt-2 text-sm text-amber-700">{disabledReason}</p>}
          {!isActive && !disabledReason && (
            <p className="mt-2 text-xs text-slate-500">«Увімкнути відправку» спершу автоматично перевірить доступи.</p>
          )}
        </>
      )}

      {check && (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
          {check.checks.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span aria-hidden="true" className={`font-bold ${CHECK_TONE[c.status]}`}>{CHECK_ICON[c.status]}</span>
              <span className="min-w-0">
                <span className="font-medium text-slate-800">{c.label}:</span>{' '}
                <span className="text-slate-600">{c.detail}</span>
              </span>
            </li>
          ))}
          <li className={`pt-1 font-medium ${check.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {check.ok ? 'Перевірку пройдено — можна вмикати відправку.' : 'Виправте помилки, щоб увімкнути відправку.'}
          </li>
        </ul>
      )}

      {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
