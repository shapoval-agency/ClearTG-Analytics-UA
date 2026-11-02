'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { CheckCircle, Pulse, WarningCircle, XCircle } from '@phosphor-icons/react';
import { runIntegrationDiagnosticsV2Action } from '@/app/v2/actions';
import { Badge, Card } from '@/components/v2/ui';
import type { IntegrationDiagnostics, IntegrationStatus } from '@/lib/api';

const overallView = {
  working: { label: 'Працює', tone: 'ok' as const },
  attention: { label: 'Потребує уваги', tone: 'warn' as const },
  'not-configured': { label: 'Не налаштовано', tone: 'neutral' as const },
};

function formatDate(value: string | null) {
  if (!value) return 'ще не було';
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Kyiv',
  }).format(new Date(value));
}

export function IntegrationHealthPanel({ status }: { status: IntegrationStatus | null }) {
  const [pending, startTransition] = useTransition();
  const [diagnostics, setDiagnostics] = useState<IntegrationDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);

  function runDiagnostics() {
    setError(null);
    startTransition(async () => {
      const result = await runIntegrationDiagnosticsV2Action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setDiagnostics(result.diagnostics);
    });
  }

  const view = status ? overallView[status.overall] : overallView['not-configured'];

  return (
    <Card className="mb-6" title="Стан інтеграції" hint="Канал, збір кліків, посилання та рекламні підключення — в одному місці.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Pulse size={22} weight="bold" className="text-brand-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-600">Загальний стан</span>
          <Badge tone={view.tone}>{view.label}</Badge>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={runDiagnostics}
          className="min-h-11 rounded-xl bg-[#102044] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#18305f] disabled:opacity-50"
        >
          {pending ? 'Перевіряємо…' : 'Перевірити все'}
        </button>
      </div>

      {status ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-xs font-semibold text-slate-500">Канали</p>
            <p className="mt-1 text-lg font-extrabold text-[#102044]">{status.channels.ready} з {status.channels.active} готові</p>
            <p className="mt-1 text-xs text-slate-500">Перевірка: {formatDate(status.channels.lastCheckedAt)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-xs font-semibold text-slate-500">Збір через посилання</p>
            <p className="mt-1 text-lg font-extrabold text-[#102044]">{status.tracking.activeLinks} активних</p>
            <p className="mt-1 text-xs text-slate-500">Останній клік: {formatDate(status.tracking.lastClickAt)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-xs font-semibold text-slate-500">Реклама</p>
            <p className="mt-1 text-lg font-extrabold text-[#102044]">{status.ads.connected.length || 0} підключень</p>
            <p className="mt-1 truncate text-xs text-slate-500">{status.ads.connected.join(', ') || 'Необовʼязково для аналітики каналів'}</p>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Зведений стан тимчасово недоступний. Окремі картки каналів продовжують працювати.
        </p>
      )}

      {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {diagnostics && (
        <div className="mt-5 border-t border-slate-100 pt-4" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-[#102044]">Результат діагностики</h3>
            <Badge tone={diagnostics.overall === 'working' ? 'ok' : diagnostics.overall === 'error' ? 'error' : 'warn'}>
              {diagnostics.overall === 'working' ? 'Все гаразд' : diagnostics.overall === 'error' ? 'Є помилки' : 'Є зауваження'}
            </Badge>
          </div>
          <ul className="space-y-2">
            {diagnostics.checks.map((check) => {
              const Icon = check.status === 'ok' ? CheckCircle : check.status === 'error' ? XCircle : WarningCircle;
              return (
                <li key={check.id} className="flex min-w-0 gap-3 rounded-xl border border-slate-100 p-3">
                  <Icon
                    size={21}
                    weight="fill"
                    className={check.status === 'ok' ? 'text-emerald-500' : check.status === 'error' ? 'text-rose-500' : check.status === 'info' ? 'text-blue-500' : 'text-amber-500'}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#102044]">{check.label}</p>
                    <p className="mt-0.5 text-sm leading-5 text-slate-600">{check.detail}</p>
                    {check.actionHref && (
                      <Link href={check.actionHref} className="mt-1 inline-block text-sm font-semibold text-brand-700 hover:underline">
                        Виправити →
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
