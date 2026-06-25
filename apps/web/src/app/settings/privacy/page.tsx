import { PageHeader } from '@/components/ui';
import Link from 'next/link';

export default function PrivacySettingsPage() {
  return (
    <div>
      <PageHeader title="Налаштування приватності" />
      <div className="grid gap-4 max-w-2xl">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium">Зберігання даних</h3>
          <p className="text-sm text-slate-500 mt-1">За замовчуванням: 365 днів. Налаштовується per workspace.</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium">Запит на видалення даних</h3>
          <p className="text-sm text-slate-500 mt-1">Ви можете запросити видалення даних.</p>
          <Link href="/privacy" className="text-brand-600 text-sm mt-2 inline-block">Деталі в Політиці конфіденційності</Link>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium">Журнал згод (Consent Log)</h3>
          <p className="text-sm text-slate-500 mt-1">Кожен клік зберігає snapshot згоди на момент переходу.</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium">Цілі обробки (Record of Processing)</h3>
          <ul className="text-sm text-slate-600 mt-2 space-y-1 list-disc list-inside">
            <li>Аналітика ефективності реклами Telegram-каналів</li>
            <li>Атрибуція підписок до джерел трафіку</li>
            <li>Передача підтверджених подій у рекламні системи (за згодою)</li>
            <li>Виконання запитів суб&apos;єктів даних (видалення, експорт)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
