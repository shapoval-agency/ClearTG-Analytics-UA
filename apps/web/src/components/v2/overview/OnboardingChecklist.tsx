import Link from 'next/link';
import clsx from 'clsx';
import { Card } from '@/components/v2/ui';

export interface OnboardingStep {
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
}

/**
 * Стан першого запуску — заміняє всі чотири блоки, поки жодної підписки ще
 * не було. Три кроки з реальною відміткою виконання (не статичний текст):
 * підключений канал, створене посилання (tracking/invite — «просте» t.me не
 * рахуємо, бо джерело за ним не визначається), перший клік.
 *
 * Вступний рядок над списком — CORE_MVP_UX_AUDIT.md, розділ 1, знахідка 2:
 * кроки описують дії, але не пояснювали, навіщо вони. Формулювання свідомо
 * повторює вже перевірену фразу з ConnectChannelPanel, а не вигадує нову.
 */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  return (
    <Card title="Почніть з трьох кроків" hint="Після першого кліку тут з'явиться повна картина">
      <p className="text-sm text-slate-600 mb-5">
        Побачите, звідки приходить кожен підписник вашого Telegram-каналу і скільки з них залишається.
      </p>
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-start gap-3">
            <span
              className={clsx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
              )}
            >
              {step.done ? '✓' : index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={clsx('text-sm font-medium', step.done ? 'text-slate-400 line-through' : 'text-slate-800')}>
                {step.label}
              </p>
              {!step.done && step.href && step.cta && (
                <Link href={step.href} className="text-sm text-brand-600 hover:underline">
                  {step.cta}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
