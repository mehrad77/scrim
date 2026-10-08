import {
  channelName,
  PROTOCOL_VERSION,
  type ClientMessage,
  type HostMessage,
  type LocalMessage,
} from '@scrim/protocol';

type Payload<M> = M extends LocalMessage ? Omit<M, 'v'> : never;

/** Typed BroadcastChannel for one show; ignores messages from other protocol versions. */
export class ShowChannel {
  #channel: BroadcastChannel;
  #listeners = new Set<(msg: LocalMessage) => void>();

  constructor(showId: string) {
    this.#channel = new BroadcastChannel(channelName(showId));
    this.#channel.onmessage = (e: MessageEvent<LocalMessage>) => {
      if (e.data?.v !== PROTOCOL_VERSION) return;
      for (const l of this.#listeners) l(e.data);
    };
  }

  post(msg: Payload<HostMessage> | Payload<ClientMessage>): void {
    this.#channel.postMessage({ ...msg, v: PROTOCOL_VERSION });
  }

  on(listener: (msg: LocalMessage) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  close(): void {
    this.#listeners.clear();
    this.#channel.close();
  }
}
