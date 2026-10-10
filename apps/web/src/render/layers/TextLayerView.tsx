import { currentCaption, interpolate } from '@scrim/engine';
import type { TextLayer } from '@scrim/format';
import type { JoinInfo } from '@scrim/protocol';
import { useEffect, useState } from 'react';
import type { LayerViewProps } from './LayerView.js';
import { sizingClass, textStyle } from './text.js';

export function TextLayerView({ layer, show, state, join }: LayerViewProps<TextLayer>) {
  const text = state.layers[layer.id]?.text ?? layer.text;
  const shown = interpolate(text, show, state.vars, {
    caption: currentCaption(show, state.access),
    ...joinText(join),
  });
  if (layer.qr) return <QrCode text={shown} color={layer.color} background={layer.background} />;
  return (
    <div
      className={`flex items-center ${sizingClass(layer.sizing, 'overflow-hidden whitespace-pre-wrap')}`}
      style={textStyle(layer)}
    >
      <span className="w-full">{shown}</span>
    </div>
  );
}

/**
 * The join built-ins. With no room open they are empty, so the audience never sees a stale
 * code; where no show is running (the editor) they read as an example.
 */
function joinText(join: JoinInfo | null | undefined): Record<string, string> {
  if (join) return { join_code: join.code, join_url: join.url };
  if (join === null) return { join_code: '', join_url: '' };
  return { join_code: 'ABCDE', join_url: `${location.origin}/audience.html?r=ABCDE` };
}

/** Text drawn as a square QR code filling the box; the library loads only when one is shown. */
function QrCode({ text, color, background }: { text: string; color: string; background: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    if (!text) return setSvg('');
    // Dark on light with a quiet zone, which every phone's camera reads; colours that would
    // make a pale or inverted code fall back to black on white.
    let dark = hex8(color, '#000000');
    let light = hex8(background, '#ffffff');
    if (luma(dark) > luma(light) - 0.45) [dark, light] = ['#000000', '#ffffff'];
    void import('qrcode')
      .then(({ default: QR }) =>
        QR.toString(text, {
          type: 'svg',
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark, light },
        }),
      )
      .then(
        (s) => alive && setSvg(s),
        () => alive && setSvg(''),
      );
    return () => {
      alive = false;
    };
  }, [text, color, background]);
  return (
    <div
      className="flex size-full items-center justify-center [&>svg]:size-full"
      role="img"
      aria-label={text ? `QR code for ${text}` : undefined}
      // The library's own SVG markup, from the text alone.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Rough lightness of #rrggbb, 0–1. */
function luma(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** The QR library takes #rrggbb(aa) only. */
function hex8(color: string, fallback: string): string {
  return /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color) ? color : fallback;
}
