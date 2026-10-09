import type { AudienceToRelay, MomentSpec, MomentTotals, PublicMoment } from '@scrim/protocol';

interface MomentData {
  spec: MomentSpec;
  votes: Record<string, string>;
  sliders: Record<string, number>;
  taps: number;
  entries: { id: string; text: string; client: string }[];
  /** Index into `entries` of the first entry the host has not seen. */
  sent: number;
  props: Record<string, string>;
}

export interface AggregatorSnapshot {
  title: string;
  moments: MomentData[];
}

const MAX_ENTRIES_PER_CLIENT = 3;
const MAX_TAPS_PER_SECOND = 15;
/** People one shared tablet can answer for in one moment. */
const MAX_BALLOTS_PER_DEVICE = 1000;

/**
 * Collects audience input for the open moments. The host only ever receives
 * running totals, so hundreds of phones cost the show machine a few small
 * messages a second.
 */
export class Aggregator {
  title = '';
  #moments = new Map<string, MomentData>();
  #dirty = new Set<string>();
  #tapBudget = new Map<string, { tokens: number; at: number }>();

  constructor(
    snapshot?: AggregatorSnapshot,
    private readonly random: () => number = Math.random,
  ) {
    if (!snapshot) return;
    this.title = snapshot.title;
    for (const m of snapshot.moments) this.#moments.set(m.spec.id, m);
  }

  snapshot(): AggregatorSnapshot {
    return { title: this.title, moments: [...this.#moments.values()] };
  }

  get dirty(): boolean {
    return this.#dirty.size > 0;
  }

  /** Replace the set of open moments. Returns true if the audience view changed. */
  setOpen(title: string, specs: MomentSpec[]): boolean {
    let changed = title !== this.title;
    this.title = title;
    const ids = new Set(specs.map((s) => s.id));
    for (const id of this.#moments.keys()) {
      if (!ids.has(id)) {
        this.#moments.delete(id);
        changed = true;
      }
    }
    for (const spec of specs) {
      const existing = this.#moments.get(spec.id);
      if (existing) {
        if (JSON.stringify(existing.spec) !== JSON.stringify(spec)) changed = true;
        existing.spec = spec;
      } else {
        this.#moments.set(spec.id, {
          spec,
          votes: {},
          sliders: {},
          taps: 0,
          entries: [],
          sent: 0,
          props: {},
        });
        this.#dirty.add(spec.id);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Apply one phone's input. Returns false if it was ignored. `ballot` is set only for a shared
   * tablet: then each ballot number is a person of its own, up to a cap per device.
   */
  input(
    client: string,
    msg: Exclude<AudienceToRelay, { t: 'ping' }>,
    now: number,
    ballot?: number,
  ): boolean {
    const m = this.#moments.get(msg.momentId);
    if (!m || (m.spec.closesAt !== null && now > m.spec.closesAt)) return false;
    const { spec } = m;
    const voter = ballot === undefined ? client : `${client}#${ballot}`;
    if (ballot !== undefined && !this.#ballotFits(m, client, voter)) return false;
    switch (msg.t) {
      case 'vote':
        if (spec.type !== 'vote' || !spec.options.some((o) => o.id === msg.optionId)) return false;
        m.votes[voter] = msg.optionId;
        break;
      case 'tap': {
        if (spec.type !== 'tap') return false;
        const allowed = this.#takeTaps(client, msg.count, now);
        if (!allowed) return false;
        m.taps += allowed;
        break;
      }
      case 'slider':
        if (spec.type !== 'slider') return false;
        m.sliders[voter] = Math.min(spec.max, Math.max(spec.min, msg.value));
        break;
      case 'text': {
        if (spec.type !== 'text') return false;
        if (m.entries.filter((e) => e.client === voter).length >= MAX_ENTRIES_PER_CLIENT)
          return false;
        m.entries.push({
          id: `${client.slice(0, 8)}-${m.entries.length}`,
          text: msg.text,
          client: voter,
        });
        break;
      }
    }
    this.#dirty.add(spec.id);
    return true;
  }

  /** Personal prop for a phone, assigned on first ask and then fixed. */
  propFor(client: string, momentId: string): { label: string; content: string } | undefined {
    const m = this.#moments.get(momentId);
    if (!m || m.spec.type !== 'prop' || !m.spec.variants.length) return undefined;
    let id = m.props[client];
    if (!id) {
      const total = m.spec.variants.reduce((n, v) => n + v.weight, 0);
      let pick = this.random() * total;
      id = m.spec.variants.find((v) => (pick -= v.weight) < 0)?.id ?? m.spec.variants[0]!.id;
      m.props[client] = id;
      this.#dirty.add(momentId);
    }
    const v = m.spec.variants.find((x) => x.id === id);
    return v && { label: v.label, content: v.content };
  }

  publicView(client: string): PublicMoment[] {
    return [...this.#moments.values()].map(({ spec }) => {
      const view: PublicMoment = {
        id: spec.id,
        type: spec.type,
        prompt: spec.prompt,
        options: spec.options,
        min: spec.min,
        max: spec.max,
        closesAt: spec.closesAt,
      };
      const prop = this.propFor(client, spec.id);
      if (prop) view.prop = prop;
      return view;
    });
  }

  /** Totals for moments that changed, or for all with every entry after a host reconnect. */
  takeTotals(all = false): MomentTotals[] {
    const ids = all ? [...this.#moments.keys()] : [...this.#dirty];
    this.#dirty.clear();
    const out: MomentTotals[] = [];
    for (const id of ids) {
      const m = this.#moments.get(id);
      if (!m) continue;
      const tally: Record<string, number> = {};
      for (const option of Object.values(m.votes)) tally[option] = (tally[option] ?? 0) + 1;
      for (const variant of Object.values(m.props)) tally[variant] = (tally[variant] ?? 0) + 1;
      const values = Object.values(m.sliders);
      const from = all ? 0 : m.sent;
      out.push({
        momentId: id,
        tally,
        count: m.taps,
        sum: values.reduce((a, b) => a + b, 0),
        sumSq: values.reduce((a, b) => a + b * b, 0),
        n:
          m.spec.type === 'vote'
            ? Object.keys(m.votes).length
            : m.spec.type === 'prop'
              ? Object.keys(m.props).length
              : m.spec.type === 'text'
                ? m.entries.length
                : values.length,
        entries: m.entries.slice(from).map(({ id: entryId, text }) => ({ id: entryId, text })),
      });
      m.sent = m.entries.length;
    }
    return out;
  }

  /** A new person on a shared tablet is let in only while the device is under its cap. */
  #ballotFits(m: MomentData, client: string, voter: string): boolean {
    if (voter in m.votes || voter in m.sliders || m.entries.some((e) => e.client === voter))
      return true;
    const prefix = `${client}#`;
    const people = new Set(
      [
        ...Object.keys(m.votes),
        ...Object.keys(m.sliders),
        ...m.entries.map((e) => e.client),
      ].filter((k) => k.startsWith(prefix)),
    );
    return people.size < MAX_BALLOTS_PER_DEVICE;
  }

  #takeTaps(client: string, count: number, now: number): number {
    const b = this.#tapBudget.get(client) ?? { tokens: MAX_TAPS_PER_SECOND, at: now };
    b.tokens = Math.min(
      MAX_TAPS_PER_SECOND,
      b.tokens + ((now - b.at) / 1000) * MAX_TAPS_PER_SECOND,
    );
    b.at = now;
    const allowed = Math.min(count, Math.floor(b.tokens));
    b.tokens -= allowed;
    this.#tapBudget.set(client, b);
    return allowed;
  }
}
