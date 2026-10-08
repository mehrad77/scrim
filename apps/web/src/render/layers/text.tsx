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
