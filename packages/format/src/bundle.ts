import {
  Unzip,
  UnzipInflate,
  UnzipPassThrough,
  Zip,
  ZipDeflate,
  ZipPassThrough,
  strFromU8,
  strToU8,
} from 'fflate';
import { parseShow, ShowFormatError } from './migrate.js';
import type { Show } from './schema.js';

/**
 * A .scrim bundle is a zip: `manifest.json` (written first) followed by one
 * `media/<mediaId>` entry per media item. Media is stored, not compressed.
 */
export const BUNDLE_VERSION = 1;
export const BUNDLE_MIME = 'application/vnd.scrim+zip';

interface Manifest {
  format: 'scrim-bundle';
  version: number;
  exportedAt: number;
  show: unknown;
}

export interface BundleMediaSource {
  id: string;
  open: () => ReadableStream<Uint8Array> | Promise<ReadableStream<Uint8Array>>;
}

/** Stream a bundle; media is read lazily as the consumer pulls. */
export function writeBundle(show: Show, media: BundleMediaSource[]): ReadableStream<Uint8Array> {
  const queue = [...media];
  let current: { reader: ReadableStreamDefaultReader<Uint8Array>; entry: ZipPassThrough } | null =
    null;
  let zip!: Zip;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      zip = new Zip((err, data, final) => {
        if (err) return controller.error(err);
        if (data.length) controller.enqueue(data);
        if (final) controller.close();
      });
      const manifest: Manifest = {
        format: 'scrim-bundle',
        version: BUNDLE_VERSION,
        exportedAt: Date.now(),
        show,
      };
      const entry = new ZipDeflate('manifest.json', { level: 6 });
      zip.add(entry);
      entry.push(strToU8(JSON.stringify(manifest)), true);
    },
    async pull() {
      // Each pull moves at most one chunk of media into the zip, so a slow
      // consumer (a file on disk) bounds memory to roughly one chunk.
      for (;;) {
        if (!current) {
          const next = queue.shift();
          if (!next) {
            zip.end();
            return;
          }
          const entry = new ZipPassThrough(`media/${next.id}`);
          zip.add(entry);
          current = { reader: (await next.open()).getReader(), entry };
        }
        const { done, value } = await current.reader.read();
        if (done) {
          current.entry.push(new Uint8Array(0), true);
          current = null;
          continue;
        }
        current.entry.push(value, false);
        return;
      }
    },
    cancel() {
      void current?.reader.cancel();
      zip.terminate();
    },
  });
}

export interface MediaSink {
  write(chunk: Uint8Array): Promise<void> | void;
  close(): Promise<void> | void;
}

export interface ReadBundleOptions {
  /** Called once per media entry, after the manifest has been read. */
  openMedia(mediaId: string, show: Show): MediaSink | Promise<MediaSink>;
}

/** Read and validate a bundle, streaming each media entry into a sink. */
export async function readBundle(
  stream: ReadableStream<Uint8Array>,
  options: ReadBundleOptions,
): Promise<Show> {
  let show: Show | null = null;
  let manifestText = '';
  let failure: unknown = null;
  const pending: Promise<void>[] = [];
  const seen = new Set<string>();

  const unzip = new Unzip((file) => {
    if (file.name === 'manifest.json') {
      const chunks: Uint8Array[] = [];
      file.ondata = (err, data, final) => {
        if (err) return void (failure = err);
        chunks.push(data);
        if (final) {
          manifestText = strFromU8(concat(chunks));
          try {
            const manifest = JSON.parse(manifestText) as Manifest;
            if (manifest.format !== 'scrim-bundle')
              throw new ShowFormatError('Not a .scrim bundle');
            if (manifest.version > BUNDLE_VERSION) {
              throw new ShowFormatError('This bundle was made with a newer Scrim');
            }
            show = parseShow(manifest.show);
          } catch (e) {
            failure = e;
          }
        }
      };
      file.start();
      return;
    }
    const match = /^media\/(.+)$/.exec(file.name);
    if (!match) return;
    const mediaId = match[1]!;
    if (!show) {
      failure ??= new ShowFormatError('Bundle media appears before its manifest');
      return;
    }
    if (!show.media.some((m) => m.id === mediaId)) return;
    seen.add(mediaId);
    // Chain writes per file so chunks land in order.
    let chain: Promise<unknown> = Promise.resolve(options.openMedia(mediaId, show));
    let sink: MediaSink | null = null;
    file.ondata = (err, data, final) => {
      if (err) return void (failure = err);
      chain = chain.then(async (s) => {
        sink ??= s as MediaSink;
        if (data.length) await sink.write(data);
        if (final) await sink.close();
        return sink;
      });
      pending.push(chain.then(() => undefined));
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);

  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      unzip.push(new Uint8Array(0), true);
      break;
    }
    unzip.push(value, false);
    // Let queued media writes catch up before feeding more input.
    if (pending.length) {
      await Promise.all(pending.splice(0));
    }
    if (failure) {
      await reader.cancel();
      throw failure;
    }
  }
  await Promise.all(pending);
  if (failure) throw failure;
  if (!show) throw new ShowFormatError('Bundle has no manifest');
  const missing = (show as Show).media.filter((m) => !seen.has(m.id));
  if (missing.length) {
    throw new ShowFormatError(`Bundle is missing media: ${missing.map((m) => m.name).join(', ')}`);
  }
  return show;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
