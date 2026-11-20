'use client';

import { useState, useTransition } from 'react';
import { updateJoinRequestSettingsV2Action } from '@/app/v2/actions';

/**
 * S2-14 / S2-15: закритий канал із заявками на вступ.
 *
 * «Вступ через заявки» — наші посилання створюють заявку, і вона несе точне
 * джерело кліку аж до схвалення. «Схвалювати автоматично» — бот приймає
 * заявку за секунди, людині не треба чекати адміна.
 */
export function JoinRequestSettings({
  channelId,
  joinRequestsEnabled,
  autoApproveJoinRequests,
  botCanInviteUsers,
}: {
  channelId: string;
  joinRequestsEnabled: boolean;
  autoApproveJoinRequests: boolean;
  botCanInviteUsers?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState({ joinRequestsEnabled, autoApproveJoinRequests });

  function save(next: typeof state) {
    setError(null);
    const previous = state;
    setState(next);
    startTransition(async () => {
      const res = await updateJoinRequestSettingsV2Action(channelId, next);
      if (res.error) {
        setError(res.error);
        setState(previous);
      }
    });
  }

  return (
    <details className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-slate-700">
        Вступ через заявки
        <span className="ml-2 font-normal text-slate-500">
          {state.joinRequestsEnabled
            ? state.autoApproveJoinRequests ? '· схвалюються автоматично' : '· схвалює адмін'
            : '· вимкнено'}
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" disabled={pending} checked={state.joinRequestsEnabled}
            onChange={(e) => save({
              joinRequestsEnabled: e.target.checked,
              autoApproveJoinRequests: e.target.checked && state.autoApproveJoinRequests,
            })} />
          <span>
            <span className="block font-medium text-slate-900">Канал приймає підписників через заявки</span>
            <span className="block text-slate-500">
              Наші посилання створюватимуть заявку замість прямого вступу. Джерело кліку збережеться
              до моменту схвалення — навіть якщо адмін схвалить заявку пізніше.
            </span>
          </span>
        </label>
        <label className={`flex items-start gap-2 ${state.joinRequestsEnabled ? '' : 'opacity-50'}`}>
          <input type="checkbox" className="mt-1"
            disabled={pending || !state.joinRequestsEnabled} checked={state.autoApproveJoinRequests}
            onChange={(e) => save({ ...state, autoApproveJoinRequests: e.target.checked })} />
          <span>
            <span className="block font-medium text-slate-900">Схвалювати заявки автоматично</span>
            <span className="block text-slate-500">
              Бот приймає кожну заявку за кілька секунд. Потрібне право бота «Додавання учасників».
            </span>
            {botCanInviteUsers === false && (
              <span className="mt-1 block text-amber-700">
                Зараз у бота немає цього права — увімкніть його в Telegram і натисніть «Перевірити».
              </span>
            )}
          </span>
        </label>
        {error && <p className="text-red-700">{error}</p>}
      </div>
    </details>
  );
}
