import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class combiner used by every component.
 *
 * `twMerge` is what makes token overrides predictable: a caller can pass
 * `bg-card` to a component whose default is `bg-background` and win, instead of
 * fighting specificity in the cascade.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
