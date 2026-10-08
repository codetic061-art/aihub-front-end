'use client';

/**
 * The header's search trigger.
 *
 * The dialog (`search-dialog.tsx`) owns the open state and every key binding, so
 * this control only dispatches `search:open`. Two independent listeners (this
 * button and the global "/" shortcut) therefore cannot disagree about whether
 * the dialog is open — there is exactly one source of truth.
 *
 * `aria-haspopup="dialog"` is what makes this announce as a control that opens a
 * dialog, rather than an unlabelled icon.
 */

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function SearchButton({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const ts = useTranslations('search');

  return (
    <button
      type="button"
      onClick={() => document.dispatchEvent(new CustomEvent('search:open'))}
      aria-haspopup="dialog"
      aria-label={`${ts('label')}, ${ts('shortcut')}`}
      title={`${ts('label')} (${ts('shortcut')})`}
      className={
        className ??
        'inline-flex h-9 items-center gap-2 rounded-[length:var(--radius-md)] border border-border px-2.5 transition-colors duration-[var(--dur-1)] hover:bg-muted'
      }
    >
      <Search className="size-4" aria-hidden />
      {/* The label collapses before the icon does, so the control is never an
          unlabelled dot on a narrow screen. */}
      <span className="hidden text-[length:var(--fs-caption)] text-muted-foreground sm:inline">
        {t('search')}
      </span>
      <kbd className="hidden font-mono text-[length:var(--fs-mono)] text-muted-foreground lg:inline">
        {ts('shortcut')}
      </kbd>
    </button>
  );
}