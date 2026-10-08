import { twMerge } from 'tailwind-merge';

/** Join class names; later Tailwind utilities override earlier conflicting ones. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
