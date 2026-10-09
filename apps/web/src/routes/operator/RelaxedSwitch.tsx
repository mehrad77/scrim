import { isRelaxed, relaxedSettings } from '@scrim/engine';
import { Feather } from 'lucide-react';
import { Button } from '../../ui/Button.js';
import { HoldButton } from '../../ui/HoldButton.js';
import { Lamp } from '../../ui/Lamp.js';
import { useHost } from './Operator.js';

/**
 * The relaxed performance switch, chosen per performance: outputs dim, sound is capped, fades
 * slow down, intense layers stay off and cues play their gentler versions. In Show mode it takes
 * a one-second hold, like every rare change the audience would see.
 */
export function RelaxedSwitch() {
  const [host, snap] = useHost();
  const on = isRelaxed(snap.state);
  const r = relaxedSettings(snap.show);
  const what = `outputs at ${Math.round(r.brightness * 100)}%, sound at most ${Math.round(r.volume * 100)}%, fades at least ${r.minFade} s, intense layers left out`;
  const toggle = () => host.dispatch({ type: 'relaxed', on: !on });

  if (snap.mode !== 'show')
    return (
      <Button
        size="sm"
        variant={on ? 'primary' : 'ghost'}
        icon={<Feather size={14} />}
        aria-pressed={on}
        onClick={toggle}
        title={
          on ? `Relaxed performance: ${what}. Click to end it` : `Relaxed performance: ${what}`
        }
      >
        Relaxed
      </Button>
    );
  return (
    <div className="flex items-center gap-2">
      {on && (
        <Lamp tone="off" icon={<Feather size={12} />} className="text-fg" title={what}>
          Relaxed
        </Lamp>
      )}
      <HoldButton
        icon={!on && <Feather size={13} />}
        label={
          on
            ? 'Hold for a second to end the relaxed performance'
            : `Hold for a second to start a relaxed performance: ${what}`
        }
        onConfirm={toggle}
      >
        {on ? 'Hold to end' : 'Hold: relaxed'}
      </HoldButton>
    </div>
  );
}
