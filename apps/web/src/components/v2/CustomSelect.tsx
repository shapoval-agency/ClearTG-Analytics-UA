'use client';

import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { CaretDown, Check } from '@phosphor-icons/react';

export interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function CustomSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Оберіть…',
  disabled = false,
  variant = 'light',
  align = 'start',
  className,
  buttonClassName,
}: {
  id?: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: 'light' | 'dark';
  align?: 'start' | 'end';
  className?: string;
  buttonClassName?: string;
}) {
  const generatedId = useId();
  const buttonId = id ?? `v2-select-${generatedId}`;
  const listboxId = `${buttonId}-options`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    const firstEnabled = options.findIndex((option) => !option.disabled);
    setActiveIndex(selectedIndex >= 0 && !options[selectedIndex]?.disabled
      ? selectedIndex
      : Math.max(0, firstEnabled));
  }, [open, options, selectedIndex]);

  useEffect(() => {
    function closeFromOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeFromOutside);
    return () => document.removeEventListener('pointerdown', closeFromOutside);
  }, []);

  function moveActive(step: 1 | -1) {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let count = 0; count < options.length; count += 1) {
      next = (next + step + options.length) % options.length;
      if (!options[next]?.disabled) {
        setActiveIndex(next);
        return;
      }
    }
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' && open) {
      event.preventDefault();
      const index = options.findIndex((option) => !option.disabled);
      if (index >= 0) setActiveIndex(index);
      return;
    }
    if (event.key === 'End' && open) {
      event.preventDefault();
      const index = options.findLastIndex((option) => !option.disabled);
      if (index >= 0) setActiveIndex(index);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex);
      else setOpen(true);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
    if (event.key === 'Tab') setOpen(false);
  }

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        className={clsx(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold shadow-[0_1px_2px_rgba(16,32,68,0.04)] outline-none transition',
          variant === 'dark'
            ? 'border-white/15 bg-white/10 text-white hover:border-white/25 hover:bg-white/15'
            : 'border-[#d8e1ee] bg-white text-[#102044] hover:border-[#b9c8dc] hover:bg-[#fbfdff]',
          open && (variant === 'dark'
            ? 'border-white/30 bg-white/15 ring-2 ring-white/15'
            : 'border-brand-400 ring-4 ring-brand-100/70'),
          'disabled:cursor-not-allowed disabled:opacity-50',
          buttonClassName,
        )}
      >
        <span className={clsx('min-w-0 flex-1 truncate', !selected && variant === 'light' && 'text-slate-400')}>
          {selected?.label ?? placeholder}
        </span>
        <CaretDown
          size={17}
          weight="bold"
          aria-hidden="true"
          className={clsx('shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={buttonId}
          className={clsx(
            'absolute top-full z-[70] mt-2 max-h-72 min-w-full overflow-y-auto rounded-2xl border border-[#d8e1ee] bg-white p-1.5 text-[#102044] shadow-[0_18px_50px_rgba(9,37,88,0.18)]',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.value}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onPointerMove={() => !option.disabled && setActiveIndex(index)}
                onClick={() => choose(index)}
                className={clsx(
                  'flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  isActive ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-50',
                  isSelected ? 'font-bold' : 'font-medium',
                  'disabled:cursor-not-allowed disabled:text-slate-300',
                )}
              >
                <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
                {isSelected && <Check size={17} weight="bold" className="shrink-0 text-brand-600" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
