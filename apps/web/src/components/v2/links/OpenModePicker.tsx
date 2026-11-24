'use client';

import { OPEN_MODES, type OpenMode } from './link-kind';

/**
 * Як відкривати Telegram після кліку (S2-11, S3-13, S3-14).
 * Компроміс «швидкість ↔ точність» показуємо людськими словами, без режимів і мілісекунд.
 */
export function OpenModePicker({
  value,
  onChange,
  name,
  compact = false,
}: {
  value: OpenMode;
  onChange: (mode: OpenMode) => void;
  name: string;
  compact?: boolean;
}) {
  return (
    <fieldset className={compact ? '' : 'mb-4'}>
      <legend className={compact ? 'mb-1 text-xs font-bold text-[#102044]' : 'mb-1.5 block text-sm font-bold text-[#102044]'}>
        Як відкривати Telegram
      </legend>
      <div className="space-y-2">
        {OPEN_MODES.map((mode) => (
          <label key={mode.value}
            className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition ${
              value === mode.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
            }`}>
            <input type="radio" name={name} className="mt-1" checked={value === mode.value}
              onChange={() => onChange(mode.value)} />
            <span>
              <span className="block font-medium text-slate-900">{mode.label}</span>
              <span className="block text-slate-500">{mode.description}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">Можна змінити пізніше — адреса посилання не зміниться. Діє на нові кліки.</p>
    </fieldset>
  );
}
