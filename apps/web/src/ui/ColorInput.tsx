import { Pipette } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { IconButton } from './Button.js';

interface EyeDropperLike {
  open(): Promise<{ sRGBHex: string }>;
}

/**
 * A colour well with an eyedropper (the browser's EyeDropper API, where available), so colours
 * can be picked from anywhere on screen.
 */
export function ColorInput({
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const Dropper = (window as unknown as { EyeDropper?: new () => EyeDropperLike }).EyeDropper;
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <input
        type="color"
        aria-label={ariaLabel}
        value={value}
        className="h-control w-full min-w-10 rounded-control border border-line-control bg-control"
        onChange={(e) => onChange(e.target.value)}
      />
      {Dropper && (
        <IconButton
          label="Pick a colour from the screen"
          icon={<Pipette size={13} />}
          onClick={async () => {
            try {
              onChange((await new Dropper().open()).sRGBHex);
            } catch {
              // cancelled
            }
          }}
        />
      )}
    </div>
  );
}
