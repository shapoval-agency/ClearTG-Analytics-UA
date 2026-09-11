'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  createCampaignV2Action,
  createTrackingLinkV2Action,
  createSeedInviteLinkV2Action,
} from '@/app/v2/actions';
import { CopyButton } from './CopyButton';
import {
  TRAFFIC_SOURCES,
  linkKindOptions,
  requiresCampaign,
  type LinkKind,
  type TrafficSource,
} from './link-kind';

export interface BuilderChannel {
  id: string;
  title: string;
  username: string | null;
}

export interface BuilderCampaign {
  id: string;
  name: string;
  adPlatform: string;
  channelId: string;
}

/**
 * Конструктор посилання.
 *
 * Порядок питань: канал → джерело трафіку → назва → кампанія → тип → мітки.
 * Джерело обирається ДО кампанії і стає її платформою: саме платформа
 * кампанії визначає на бекенді механізм посилання, тож два різні джерела
 * в одній формі суперечили б одне одному.
 */
export function LinkBuilder({
  channels,
  campaigns,
  appUrl,
  onCreated,
}: {
  channels: BuilderChannel[];
  campaigns: BuilderCampaign[];
  appUrl: string;
  onCreated?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  // Кампанії, створені прямо тут. Проп `campaigns` мутувати не можна:
  // посилання на масив не зміниться, і useMemo нижче не перерахується —
  // щойно створена кампанія не з'явилася б у списку.
  const [extraCampaigns, setExtraCampaigns] = useState<BuilderCampaign[]>([]);
  const [source, setSource] = useState<TrafficSource | ''>('');
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [kind, setKind] = useState<LinkKind>('tracking');
  const [showMarks, setShowMarks] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [creativeTag, setCreativeTag] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; hint: string } | null>(null);

  const channel = channels.find((c) => c.id === channelId) ?? null;

  const options = useMemo(
    () => linkKindOptions(source || null, Boolean(channel?.username)),
    [source, channel?.username],
  );
  const selected = options.find((o) => o.kind === kind) ?? options[0];

  // Кампанії того ж каналу і того ж джерела — інші тут не мають сенсу.
  const availableCampaigns = useMemo(() => {
    // Дедуплікація за id обов'язкова: після створення кампанії
    // revalidatePath оновлює серверний список, і щойно створена кампанія
    // приходить ще й у пропі `campaigns` — без цього вона з'являлася
    // у селекті двічі й ламала ключі React.
    const byId = new Map<string, BuilderCampaign>();
    for (const c of [...campaigns, ...extraCampaigns]) byId.set(c.id, c);
    return [...byId.values()].filter(
      (c) => c.channelId === channelId && (!source || c.adPlatform === source),
    );
  }, [campaigns, extraCampaigns, channelId, source]);

  function pickKind(next: LinkKind) {
    const option = options.find((o) => o.kind === next);
    if (!option?.available) return;
    setKind(next);
    setError(null);
    setResult(null);
  }

  function reset() {
    setName('');
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setCreativeTag('');
    setNewCampaignName('');
  }

  function addCampaign() {
    if (!source) {
      setError('Спочатку оберіть джерело трафіку');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createCampaignV2Action({
        channelId,
        name: newCampaignName,
        adPlatform: source,
      });
      if (res.error || !res.campaign) {
        setError(res.error ?? 'Не вдалося створити кампанію');
        return;
      }
      // Нову кампанію одразу обираємо, щоб користувач не шукав її в списку.
      setExtraCampaigns((prev) => [...prev, { ...res.campaign!, channelId }]);
      setCampaignId(res.campaign.id);
      setCreatingCampaign(false);
      setNewCampaignName('');
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!channelId) {
      setError('Оберіть канал');
      return;
    }
    if (!source) {
      setError('Оберіть джерело трафіку');
      return;
    }
    if (requiresCampaign(kind) && !campaignId) {
      setError('Для запрошувального посилання потрібна кампанія — оберіть або створіть її');
      return;
    }

    startTransition(async () => {
      if (kind === 'invite') {
        const res = await createSeedInviteLinkV2Action({ channelId, campaignId, name });
        if (res.error || !res.link) {
          setError(res.error ?? 'Не вдалося створити посилання');
          return;
        }
        setResult({
          url: res.link.telegramInviteLink,
          hint: 'Передайте це посилання партнеру або опублікуйте в джерелі.',
        });
        reset();
        onCreated?.();
        return;
      }

      const res = await createTrackingLinkV2Action({
        channelId,
        campaignId: campaignId || undefined,
        name,
        utmSource,
        utmMedium,
        utmCampaign,
        creativeTag,
      });
      if (res.error || !res.link) {
        setError(res.error ?? 'Не вдалося створити посилання');
        return;
      }
      setResult({
        url: `${appUrl}${res.link.publicPath}`,
        hint: 'Вставте цю адресу в рекламний кабінет замість прямого посилання на канал.',
      });
      reset();
      onCreated?.();
    });
  }

  // Звичайне t.me нічого не створює — показуємо готову адресу і чесне попередження.
  const plainUrl = channel?.username ? `https://t.me/${channel.username}` : null;

  const field = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-5">
      {/* 1. Канал — пропускаємо питання, якщо канал один */}
      {channels.length > 1 && (
        <div className="mb-4">
          <label className={labelCls} htmlFor="v2-link-channel">Канал</label>
          <select
            id="v2-link-channel"
            className={field}
            value={channelId}
            onChange={(e) => { setChannelId(e.target.value); setCampaignId(''); }}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Джерело трафіку */}
      <div className="mb-4">
        <label className={labelCls} htmlFor="v2-link-source">Джерело трафіку</label>
        <select
          id="v2-link-source"
          className={field}
          value={source}
          onChange={(e) => {
            setSource(e.target.value as TrafficSource);
            setCampaignId('');
            setKind('tracking');
            setResult(null);
            setError(null);
          }}
        >
          <option value="">Оберіть джерело…</option>
          {TRAFFIC_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* 3. Назва */}
      <div className="mb-4">
        <label className={labelCls} htmlFor="v2-link-name">Назва посилання</label>
        <input
          id="v2-link-name"
          type="text"
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Літня кампанія, відео 1"
        />
        <p className="text-xs text-slate-500 mt-1">
          Так посилання буде підписане у звітах.
        </p>
      </div>

      {/* 4. Кампанія */}
      <div className="mb-4">
        <label className={labelCls} htmlFor="v2-link-campaign">
          Кампанія {requiresCampaign(kind) && <span className="text-slate-400">(обов’язково)</span>}
        </label>
        {creatingCampaign ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <input
              type="text"
              className={field}
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder="Назва кампанії"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                disabled={pending || !newCampaignName.trim()}
                onClick={addCampaign}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {pending ? 'Створюємо…' : 'Створити'}
              </button>
              <button
                type="button"
                onClick={() => { setCreatingCampaign(false); setNewCampaignName(''); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Скасувати
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Джерело кампанії — те саме, що обрано вище.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              id="v2-link-campaign"
              className={`${field} flex-1 min-w-[200px]`}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">
                {requiresCampaign(kind) ? 'Оберіть кампанію…' : 'Без кампанії'}
              </option>
              {availableCampaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!source}
              onClick={() => setCreatingCampaign(true)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              + Створити кампанію
            </button>
          </div>
        )}
      </div>

      {/* 5. Тип посилання — недоступні варіанти показуємо з поясненням */}
      <fieldset className="mb-4">
        <legend className={labelCls}>Тип посилання</legend>
        <div className="space-y-2">
          {options.map((option) => (
            <label
              key={option.kind}
              className={`block rounded-lg border p-3 ${
                option.available
                  ? kind === option.kind
                    ? 'border-brand-500 bg-brand-50 cursor-pointer'
                    : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                  : 'border-slate-100 bg-slate-50 cursor-not-allowed'
              }`}
            >
              <span className="flex items-start gap-2">
                <input
                  type="radio"
                  name="v2-link-kind"
                  className="mt-1"
                  checked={kind === option.kind}
                  disabled={!option.available}
                  onChange={() => pickKind(option.kind)}
                />
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${option.available ? 'text-slate-900' : 'text-slate-400'}`}>
                    {option.label}
                  </span>
                  <span className="block text-sm text-slate-500 mt-0.5">
                    {option.description}
                  </span>
                  {!option.available && option.unavailableReason && (
                    <span className="block text-sm text-amber-700 mt-1">
                      {option.unavailableReason}
                    </span>
                  )}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Звичайне t.me: нічого не створюємо, показуємо готову адресу */}
      {kind === 'plain' && plainUrl && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="font-mono text-sm text-slate-900 break-all">{plainUrl}</p>
          <p className="text-sm text-amber-800 mt-2">
            Підписників за цим посиланням не можна точно пов’язати з джерелом — у звітах
            вони будуть як «джерело не визначено».
          </p>
          <div className="mt-3">
            <CopyButton value={plainUrl} />
          </div>
        </div>
      )}

      {/* 6. Мітки — тільки для посилань з мітками, згорнуто */}
      {kind === 'tracking' && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowMarks((v) => !v)}
            className="text-sm text-slate-600 hover:text-brand-700"
            aria-expanded={showMarks}
          >
            {showMarks ? '− ' : '+ '}Мітки для звітів (необов’язково)
          </button>
          {showMarks && (
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              <div>
                <label className={labelCls} htmlFor="v2-utm-source">utm_source</label>
                <input id="v2-utm-source" className={field} value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)} placeholder="meta" />
              </div>
              <div>
                <label className={labelCls} htmlFor="v2-utm-medium">utm_medium</label>
                <input id="v2-utm-medium" className={field} value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)} placeholder="cpc" />
              </div>
              <div>
                <label className={labelCls} htmlFor="v2-utm-campaign">utm_campaign</label>
                <input id="v2-utm-campaign" className={field} value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)} placeholder="summer" />
              </div>
              <div>
                <label className={labelCls} htmlFor="v2-creative">Креатив</label>
                <input id="v2-creative" className={field} value={creativeTag}
                  onChange={(e) => setCreativeTag(e.target.value)} placeholder="video_1" />
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
          {kind === 'invite' && (
            <Link href="/v2/channels" className="text-sm text-red-700 underline mt-1 inline-block">
              Перевірити права бота в розділі «Канали»
            </Link>
          )}
        </div>
      )}

      {result && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-900">Посилання готове</p>
          <p className="font-mono text-sm text-slate-900 break-all mt-1">{result.url}</p>
          <p className="text-sm text-emerald-800 mt-1">{result.hint}</p>
          <div className="mt-3">
            <CopyButton value={result.url} />
          </div>
        </div>
      )}

      {kind !== 'plain' && (
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? 'Створюємо…' : 'Створити посилання'}
        </button>
      )}
    </form>
  );
}
