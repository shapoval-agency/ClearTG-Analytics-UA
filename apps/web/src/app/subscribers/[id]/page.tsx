import { api } from '@/lib/api';
import { PageHeader, StatCard } from '@/components/ui';
import { formatDateUk, attributionTypeLabel } from '@/lib/labels';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Dossier {
  id: string;
  telegramUserId: string;
  telegramUsername: string | null;
  channel: { title: string; username: string | null };
  subscribedAt: string;
  isActive: boolean;
  daysInChannel: number;
  retainedD1: boolean | null;
  retainedD7: boolean | null;
  retainedD30: boolean | null;
  botStarted: boolean;
  botOptedOut: boolean;
  attribution: {
    type: string;
    confidence: number;
    reason: string;
    campaign: string | null;
    trackingLink: string | null;
    utm: Record<string, string | null | undefined>;
    creativeTag: string | null;
    postNumber: number | null;
    clickedAt: string | null;
    telegramOpenedAt: string | null;
  } | null;
  unsubscribes: Array<{ occurredAt: string }>;
  leadMagnets: Array<{ name: string; slug: string; claimedAt: string }>;
  conversions: Array<{ eventName: string; eventTime: string; status: string }>;
}

export default async function SubscriberDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let dossier: Dossier;
  try {
    dossier = await api<Dossier>(`/api/dashboard/subscribers/${id}`);
  } catch {
    notFound();
  }

  const attr = dossier.attribution;

  return (
    <div>
      <PageHeader
        title="Досьє підписника"
        description={
          dossier.telegramUsername
            ? `@${dossier.telegramUsername}`
            : `ID ${dossier.telegramUserId}`
        }
      >
        <Link href="/subscribers" className="text-sm text-brand-600 hover:underline">
          ← Усі учасники
        </Link>
      </PageHeader>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Канал" value={dossier.channel.title} />
        <StatCard
          label="Статус"
          value={dossier.isActive ? 'У каналі' : 'Відписався'}
        />
        <StatCard label="Днів у каналі" value={dossier.daysInChannel} />
        <StatCard
          label="Підписка"
          value={formatDateUk(dossier.subscribedAt)}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-medium mb-4">Джерело та атрибуція</h2>
          {attr ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Тип</dt>
                <dd>{attributionTypeLabel(attr.type)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Впевненість</dt>
                <dd>{Math.round(attr.confidence * 100)}%</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Кампанія</dt>
                <dd>{attr.campaign ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Посилання</dt>
                <dd>{attr.trackingLink ? `/l/${attr.trackingLink}` : '—'}</dd>
              </div>
              {attr.creativeTag && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Креатив</dt>
                  <dd>{attr.creativeTag}</dd>
                </div>
              )}
              {attr.postNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Пост №</dt>
                  <dd>{attr.postNumber}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">UTM source</dt>
                <dd>{attr.utm.source ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">UTM campaign</dt>
                <dd>{attr.utm.campaign ?? '—'}</dd>
              </div>
              {attr.clickedAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Клік</dt>
                  <dd>{formatDateUk(attr.clickedAt)}</dd>
                </div>
              )}
              {attr.telegramOpenedAt && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Відкрив Telegram</dt>
                  <dd>{formatDateUk(attr.telegramOpenedAt)}</dd>
                </div>
              )}
              <p className="text-xs text-slate-400 pt-2">{attr.reason}</p>
            </dl>
          ) : (
            <p className="text-slate-500 text-sm">Джерело не визначено</p>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-medium mb-4">Утримання та бот</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">D1</dt>
              <dd>{dossier.retainedD1 === true ? '✓' : dossier.retainedD1 === false ? '✗' : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">D7</dt>
              <dd>{dossier.retainedD7 === true ? '✓' : dossier.retainedD7 === false ? '✗' : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">D30</dt>
              <dd>{dossier.retainedD30 === true ? '✓' : dossier.retainedD30 === false ? '✗' : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Запустив бота</dt>
              <dd>{dossier.botStarted ? 'Так' : 'Ні'}</dd>
            </div>
          </dl>

          {dossier.leadMagnets.length > 0 && (
            <>
              <h3 className="font-medium mt-6 mb-2">Лід-магніти</h3>
              <ul className="text-sm space-y-1">
                {dossier.leadMagnets.map((lm) => (
                  <li key={lm.slug}>
                    {lm.name} — {formatDateUk(lm.claimedAt)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {dossier.conversions.length > 0 && (
            <>
              <h3 className="font-medium mt-6 mb-2">Конверсії в рекламу</h3>
              <ul className="text-sm space-y-1">
                {dossier.conversions.map((c, i) => (
                  <li key={i}>
                    {c.eventName} — {c.status} ({formatDateUk(c.eventTime)})
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
