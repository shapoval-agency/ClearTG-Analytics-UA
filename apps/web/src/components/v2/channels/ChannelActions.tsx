'use client';

import { useState, useTransition } from 'react';
import {
  setChannelActiveV2Action,
  checkChannelStatusV2Action,
} from '@/app/v2/actions';
import { Badge } from '@/components/v2/ui';
import {
  deriveStatusFromBotCheck,
  statusActionHints,
  type BotStatusResponse,
} from './channel-status';

/**
 * Дії над каналом: жива перевірка прав, архівація, відновлення.
 *
 * Усі виклики йдуть через server actions — клієнтський fetch на проксі
 * повернув би 401 (див. v2-channels-plan.md, розділ 2).
 */
export function ChannelActions({
  id,
  title,
  isActive,
}: {
  id: string;
  title: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [check, setCheck] = useState<BotStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function runCheck() {
    setError(null);
    startTransition(async () => {
      const res = await checkChannelStatusV2Action(id);
      if (res.error) {
        setError(res.error);
        setCheck(null);
        return;
      }
      setCheck(res.check);
    });
  }

  function setActive(next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setChannelActiveV2Action(id, next);
      if (res.error) setError(res.error);
      setConfirming(false);
    });
  }

  const checked = check ? deriveStatusFromBotCheck(check, isActive) : null;
  const hints = statusActionHints(check);

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      {/* Результат живої перевірки */}
      {checked && (
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Перевірено щойно:</span>
            <Badge tone={checked.tone}>{checked.label}</Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1.5">{checked.meaning}</p>
          {hints.length > 0 && (
            <ul className="mt-2 space-y-1">
              {hints.map((hint, i) => (
                <li key={i} className="text-sm text-amber-700">
                  → {hint}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={runCheck}
            className="text-sm text-red-700 underline mt-1 hover:text-red-900"
          >
            Спробувати ще раз
          </button>
        </div>
      )}

      {/* Підтвердження архівації — з поясненням наслідків, а не порожнє «Ви впевнені?» */}
      {confirming ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900 font-medium">
            Архівувати «{title}»?
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Збір підписок і відписок зупиниться. Уже зібрана історія та звіти
            залишаться на місці — канал можна відновити будь-коли.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => setActive(false)}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {pending ? 'Архівуємо…' : 'Так, архівувати'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100"
            >
              Скасувати
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {isActive ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={runCheck}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {pending ? 'Перевіряємо…' : 'Перевірити'}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(true)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
              >
                Архівувати
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setActive(true)}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Відновлюємо…' : 'Відновити збір'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
