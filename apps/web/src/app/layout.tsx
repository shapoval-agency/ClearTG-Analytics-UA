import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClearTG Analytics UA',
  description: 'Чесна аналітика Telegram-реклами для України',
};

/**
 * Кореневий layout — лише html/body, шрифт і глобальні стилі.
 *
 * Оболонки кабінетів живуть у власних layout-ах:
 * - новий кабінет — `app/v2/layout.tsx`;
 * - старий кабінет — `app/(legacy)/layout.tsx` (видаляється разом зі старим кабінетом).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
