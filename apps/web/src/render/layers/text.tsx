import type { TextLayer } from '@scrim/format';
import type { CSSProperties } from 'react';

/** In ems, so a shadow grows with its text. */
const SHADOWS = {
  none: undefined,
  soft: '0 0.04em 0.3em rgba(0, 0, 0, 0.55)',
  strong: '0 0.05em 0.08em rgba(0, 0, 0, 0.85), 0 0 0.6em rgba(0, 0, 0, 0.6)',
} as const;

export function textStyle(
  layer: Pick<
    TextLayer,
    | 'fontSize'
    | 'color'
    | 'fontFamily'
    | 'fontWeight'
    | 'align'
    | 'background'
    | 'lineHeight'
    | 'letterSpacing'
    | 'italic'
    | 'uppercase'
    | 'shadow'
  >,
): CSSProperties {
  return {
    fontSize: layer.fontSize,
    color: layer.color,
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    textAlign: layer.align,
    background: layer.background,
    justifyContent:
      layer.align === 'left' ? 'flex-start' : layer.align === 'right' ? 'flex-end' : 'center',
    lineHeight: layer.lineHeight ?? 1.15,
    letterSpacing: layer.letterSpacing ? `${layer.letterSpacing}em` : undefined,
    fontStyle: layer.italic ? 'italic' : undefined,
    textTransform: layer.uppercase ? 'uppercase' : undefined,
    textShadow: SHADOWS[layer.shadow ?? 'none'],
  };
}

/**
 * Classes for a text box that may size itself. `fixed` is what a w × h box adds; an auto-sized
 * box follows its text instead, so a background or a hugging frame grows with it.
 */
export function sizingClass(sizing: TextLayer['sizing'], fixed: string): string {
  if (sizing === 'autoWidth') return 'whitespace-pre';
  if (sizing === 'autoHeight') return 'w-full whitespace-pre-wrap';
  return `size-full ${fixed}`;
}
