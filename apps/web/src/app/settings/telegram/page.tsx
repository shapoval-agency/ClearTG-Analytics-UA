import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { TelegramBindButton } from '@/components/TelegramBindButton';

export default async function TelegramSettingsPage() {
  const session = await getSession();
  if (!session.token) redirect('/login');

  let me: { user: { telegramId: string | null } } | null = null;
  try {
    me = await api<{ user: { telegramId: string | null } }>('/api/auth/me');
  } catch {
    me = null;
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'cleartg_bot';

  return (
    <div>
      <PageHeader
        title="Telegram-бот"
        description="Звіти, канали та досьє підписників прямо в Telegram — як у TGTrack"
      />

      <div className="grid gap-6 max-w-2xl">
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-medium">1. Привʼяжіть кабінет</h2>
          {me?.user.telegramId ? (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
              ✅ Telegram привʼязано. Відкрийте бота @{botUsername} — меню вже доступне.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Натисніть кнопку — відкриється @{botUsername}. Після /start бот надсилатиме
                щоденні звіти о 7:00.
              </p>
              <TelegramBindButton />
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-3">
          <h2 className="font-medium">2. Додайте бота в канал</h2>
          <ol className="text-sm text-slate-600 list-decimal list-inside space-y-1">
            <li>Канал → Адміністратори → @{botUsername}</li>
            <li>Увімкніть «Додавання учасників»</li>
            <li>Бот напише вам у приват, коли канал підключиться</li>
          </ol>
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-3">
          <h2 className="font-medium">Можливості бота</h2>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>📊 /report — звіт за вчора</li>
            <li>📺 /channels — ваші канали</li>
            <li>👤 @username — досьє підписника</li>
            <li>↪️ Перешліть повідомлення від учасника — теж досьє</li>
            <li>🌅 Щоденний звіт о 7:00 (після привʼязки)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
