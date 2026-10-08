import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MetaRow } from './button';

/**
 * Card family.
 *
 * The pack names six card archetypes and forbids inventing a seventh. Four are
 * implemented here; the graph cards (NodeMap / FlowGraph / Journey) belong to
 * the landing composition, not to this primitive.
 *
 *   ResourceCard — folder-tab silhouette. LOCKED (pack L3): a tall tab on the
 *                  LEFT 70%, a 45° bevel dropping 12px. Not a plain rectangle,
 *                  and not a top-left tab.
 *   CourseCard   — colour-header media + ink sketch + "Course" badge. LOCKED (L8):
 *                  blue/orange media, never a photo, never a gradient.
 *   SessionCard  — flat row with a position marker.
 *   StatCard     — a number plus a label, for the landing dashboard row.
 *
 * Every card is outline-only. The pack forbids drop shadows and glassmorphism;
 * elevation is a border and a surface step.
 */

const CARD_BASE =
  'relative block rounded-[length:var(--radius-lg)] border border-border bg-card ' +
  'transition-colors duration-[var(--dur-2)] ease-[var(--ease)]';

/* ------------------------------------------------------- ResourceCard (L3) -- */

export function ResourceCard({
  href,
  title,
  description,
  icon,
  meta,
  accentDot,
  className,
  children,
}: {
  href: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  meta?: (string | number | null | undefined)[];
  /** Small colour dot naming the category, per the pack's card icon rule. */
  accentDot?: 'accent' | 'info' | 'muted';
  className?: string;
  children?: ReactNode;
}) {
  const dots = {
    accent: 'bg-[var(--color-accent-2)]',
    info: 'bg-[var(--color-info)]',
    muted: 'bg-[var(--color-border-muted)]',
  } as const;

  return (
    <Link
      href={href}
      className={cn(
        CARD_BASE,
        'group overflow-hidden p-5 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)]',
        className,
      )}
    >
      {/*
        The folder tab. Implemented as a pseudo-element so the 45° bevel is real
        geometry rather than a clip-path that would fight the rounded corner.
        12px drop, 45deg, on the inline-start side — which is automatically the
        RIGHT side under `dir="rtl"`, so no RTL variant is needed.
      */}
      <span
        aria-hidden
        className={cn(
          'absolute top-0 h-3 w-[70%] border border-b-0 border-border',
          'bg-card [clip-path:polygon(0_0,100%_0,100%_100%,12px_100%)]',
          'group-hover:bg-[var(--color-surface-raised)]',
          'start-0',
        )}
        style={{ borderStartStartRadius: 'var(--radius-lg)' }}
      />

      <div className="flex items-start gap-3">
        {accentDot && (
          <span
            aria-hidden
            className={cn(
              'mt-1.5 size-2 shrink-0 rounded-full',
              dots[accentDot],
            )}
          />
        )}
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[length:var(--fs-card-title)]">{title}</h3>
          {description && (
            <p className="mt-1.5 line-clamp-2 text-[length:var(--fs-small)] text-muted-foreground">
              {description}
            </p>
          )}
          {meta && meta.length > 0 && <MetaRow items={meta} className="mt-3" />}
          {children}
        </div>
      </div>
    </Link>
  );
}

/* --------------------------------------------------------- CourseCard (L8) -- */

export function CourseCard({
  href,
  title,
  description,
  level,
  minutes,
  lessons,
  badge = 'Course',
  className,
}: {
  href: string;
  title: string;
  description?: string;
  level?: string;
  minutes?: number;
  lessons?: number;
  badge?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        CARD_BASE,
        'group flex flex-col overflow-hidden hover:border-[var(--color-border-strong)]',
        className,
      )}
    >
      {/*
        Media band: flat colour + an ink line motif. The pack forbids a photo and
        forbids a gradient here, so the "image" is drawn, not loaded — which also
        means it costs no bytes and stays crisp at any size.
      */}
      <div className="relative h-32 overflow-hidden border-b border-border bg-[var(--color-accent)]">
        <svg
          aria-hidden
          viewBox="0 0 300 128"
          className="absolute inset-0 size-full text-[var(--bot-fill)]"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Shelf + book spines: the pack's L2 motif, reduced to line art. */}
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          >
            <path d="M0 104 H300" />
            <path d="M18 104 V54 M24 104 V62 M30 104 V46 M36 104 V58" />
            <path d="M48 104 V38 M56 104 V66 M64 104 V50" />
            <path d="M86 104 V70 M96 104 V60 M106 104 V76" />
            <path d="M126 104 V44 M138 104 V64 M150 104 V52" />
            <path d="M172 104 V62 M184 104 V48 M196 104 V68" />
            <path d="M218 104 V56 M230 104 V72 M242 104 V50" />
            <path d="M262 104 V66 M272 104 V58" />
          </g>
        </svg>
        <span className="absolute start-3 top-3 rounded-[length:var(--radius-sm)] bg-ink-fill px-2 py-0.5 text-[length:var(--fs-caption)] font-medium text-on-ink">
          {badge}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[length:var(--fs-card-title)]">{title}</h3>
        {description && (
          <p className="mt-1.5 line-clamp-2 text-[length:var(--fs-small)] text-muted-foreground">
            {description}
          </p>
        )}
        <MetaRow
          className="mt-4 pt-1"
          items={[level, minutes ? `${minutes} min` : null, lessons ?? null]}
        />
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------ SessionCard -- */

export function SessionCard({
  href,
  title,
  position,
  duration,
  description,
  className,
}: {
  href: string;
  title: string;
  position?: number;
  duration?: number;
  description?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-start gap-4 rounded-[length:var(--radius-md)] border border-border-muted',
        'bg-transparent p-4 transition-colors duration-[var(--dur-1)]',
        'hover:border-border hover:bg-[var(--color-surface-raised)]',
        className,
      )}
    >
      {position !== undefined && (
        <span
          aria-hidden
          className="mt-0.5 w-6 shrink-0 text-end font-mono text-[length:var(--fs-label)] text-muted-foreground tabular-nums"
        >
          {String(position).padStart(2, '0')}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-[length:var(--fs-card-title)] group-hover:text-[var(--color-accent)]">
          {title}
        </h3>
        {description && (
          <p className="mt-1 line-clamp-2 text-[length:var(--fs-small)] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {duration !== undefined && (
        <span className="shrink-0 font-mono text-[length:var(--fs-caption)] text-muted-foreground tabular-nums">
          {duration}′
        </span>
      )}
    </Link>
  );
}

/* --------------------------------------------------------------- StatCard -- */

export function StatCard({
  value,
  label,
  href,
  className,
}: {
  value: string | number;
  label: string;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <p className="font-display text-[length:var(--fs-h2)] leading-none tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-[length:var(--fs-caption)] text-muted-foreground">
        {label}
      </p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          CARD_BASE,
          'p-5 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)]',
          className,
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className={cn(CARD_BASE, 'p-5', className)}>{inner}</div>;
}