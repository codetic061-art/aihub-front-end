import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button / Link — the pack's two button shapes and nothing else.
 *
 * The pack's guardrails are explicit about buttons:
 *   - no gradients
 *   - orange is NOT a button colour, and never white-on-orange
 *   - elevation is outline only, never a shadow
 *   - radii are 4/6/8/10/pill
 * So the variants here are: solid ink (primary), blue (accent), outline, ghost,
 * and a link that looks like text. There is deliberately no orange variant and
 * no shadow variant, because adding either would break the source of truth.
 */

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'link';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  // Black ink pill — the pack's "Sign up" / primary action.
  primary:
    'bg-ink-fill text-on-ink border border-ink-fill hover:bg-[var(--color-border-strong)]',
  // The single blue accent, reserved for the main action on a page.
  accent:
    'bg-accent text-on-accent border border-accent hover:bg-[var(--color-accent-hover)]',
  outline:
    'bg-transparent text-foreground border border-border hover:bg-muted',
  ghost: 'bg-transparent text-foreground border border-transparent hover:bg-muted',
  link: 'bg-transparent text-foreground border-0 underline underline-offset-4 hover:text-accent p-0 h-auto',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[length:var(--fs-caption)] rounded-[length:var(--radius-sm)]',
  md: 'h-10 px-4 text-[length:var(--fs-button)] rounded-[length:var(--radius-md)]',
  lg: 'h-12 px-6 text-[length:var(--fs-button)] rounded-[length:var(--radius-lg)]',
};

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium leading-none ' +
  'transition-colors duration-[var(--dur-1)] ease-[var(--ease)] ' +
  'disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap';

export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  // A link-styled button has no box, so padding/height would be wrong.
  if (variant === 'link') {
    return cn(BASE, VARIANTS.link, className);
  }
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  href,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

/** Small pill label. `accent` maps to orange, used sparingly per the 10% rule. */
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'info' | 'outline';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-fill text-on-ink border-ink-fill',
    accent: 'bg-transparent text-[var(--color-accent-2)] border-[var(--color-accent-2)]',
    info: 'bg-transparent text-[var(--color-info)] border-[var(--color-info)]',
    outline: 'bg-transparent text-muted-foreground border-border',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[length:var(--radius-pill)] border px-2.5 py-0.5',
        'text-[length:var(--fs-caption)] font-medium leading-tight',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Metadata row: a caption + optional value, separated by a middot. */
export function MetaRow({
  items,
  className,
}: {
  items: (string | number | null | undefined)[];
  className?: string;
}) {
  const kept = items.filter((x): x is string | number => x !== null && x !== undefined && x !== '');
  if (kept.length === 0) return null;
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1',
        'text-[length:var(--fs-caption)] text-muted-foreground',
        className,
      )}
    >
      {kept.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-[var(--color-border-muted)]">
              ·
            </span>
          )}
          <span>{item}</span>
        </span>
      ))}
    </p>
  );
}