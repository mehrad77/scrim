import { Coffee, Gamepad2, Piano, Radio } from 'lucide-react';
import { Badge } from '../../ui/Panel.js';
import { useHost } from './Operator.js';

export function StatusChips() {
  const [, snap] = useHost();
  const { relay } = snap;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={snap.wakeLock ? 'good' : 'warn'}>
        <Coffee size={11} /> {snap.wakeLock ? 'Awake' : 'May sleep'}
      </Badge>
      {relay.status !== 'off' && (
        <Badge tone={relay.status === 'open' ? 'good' : relay.status === 'failed' ? 'bad' : 'warn'}>
          <Radio size={11} />{' '}
          {relay.status === 'open'
            ? `Room ${relay.room?.code} · ${relay.presence.audience} phone${relay.presence.audience === 1 ? '' : 's'}`
            : relay.status === 'failed'
              ? 'Room offline'
              : 'Room connecting'}
        </Badge>
      )}
      {snap.midi && (
        <Badge tone={snap.midi.length ? 'good' : 'warn'}>
          <Piano size={11} /> {snap.midi.length ? snap.midi.length : 'No'} MIDI
        </Badge>
      )}
      {snap.gamepads.length > 0 && (
        <Badge tone="good">
          <Gamepad2 size={11} /> {snap.gamepads.length}
        </Badge>
      )}
    </div>
  );
}
