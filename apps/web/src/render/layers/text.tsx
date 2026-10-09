import type { TextLayer } from '@scrim/format';
import type { CSSProperties } from 'react';

export function textStyle(
  layer: Pick<
    TextLayer,
    'fontSize' | 'color' | 'fontFamily' | 'fontWeight' | 'align' | 'background'
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
    lineHeight: 1.15,
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
