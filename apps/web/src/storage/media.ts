import { uid, type Media, type MediaKind } from '@scrim/format';

/** Media files live in the Origin Private File System, one file per media id. */
const DIR = 'media';

let dirPromise: Promise<FileSystemDirectoryHandle> | null = null;

function mediaDir(): Promise<FileSystemDirectoryHandle> {
  dirPromise ??= navigator.storage
    .getDirectory()
    .then((root) => root.getDirectoryHandle(DIR, { create: true }));
  return dirPromise;
}

export function opfsSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

export function kindOf(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
}

export async function mediaFile(id: string): Promise<File | null> {
  try {
    const handle = await (await mediaDir()).getFileHandle(id);
    return await handle.getFile();
  } catch {
    return null;
  }
}

/** Open a writable sink for a media file (used by uploads and bundle import). */
export async function mediaWriter(
  id: string,
): Promise<{ write(chunk: Uint8Array): Promise<void>; close(): Promise<void> }> {
  const handle = await (await mediaDir()).getFileHandle(id, { create: true });
  const writable = await handle.createWritable();
  urls.delete(id);
  return {
    write: (chunk) => writable.write(chunk as Uint8Array<ArrayBuffer>),
    close: () => writable.close(),
  };
}

/** Store an uploaded file and describe it. */
export async function addMediaFile(file: File): Promise<Media> {
  const kind = kindOf(file.type);
  if (!kind) throw new Error(`${file.name}: unsupported file type ${file.type || '(unknown)'}`);
  const id = uid('med');
  const handle = await (await mediaDir()).getFileHandle(id, { create: true });
  const writable = await handle.createWritable();
  await file.stream().pipeTo(writable);
  const media: Media = { id, kind, name: file.name, mime: file.type, size: file.size };
  try {
    Object.assign(media, await probe(file, kind));
  } catch {
    // metadata is optional; the pre-show check reports undecodable media
  }
  return media;
}

export async function addMediaBlob(blob: Blob, name: string): Promise<Media> {
  return addMediaFile(new File([blob], name, { type: blob.type }));
}

export async function deleteMediaFile(id: string): Promise<void> {
  revokeMediaUrl(id);
  try {
    await (await mediaDir()).removeEntry(id);
  } catch {
    // already gone
  }
}

export async function storedMediaIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const dir = await mediaDir();
  for await (const key of (dir as unknown as { keys(): AsyncIterable<string> }).keys())
    ids.add(key);
  return ids;
}

const urls = new Map<string, Promise<string | null>>();

/** Object URL for a media file, cached for the lifetime of this window. */
export function mediaUrl(id: string): Promise<string | null> {
  let url = urls.get(id);
  if (!url) {
    url = mediaFile(id).then((f) => (f ? URL.createObjectURL(f) : null));
    urls.set(id, url);
    void url.then((u) => {
      if (!u) urls.delete(id);
    });
  }
  return url;
}

export function revokeMediaUrl(id: string): void {
  const url = urls.get(id);
  urls.delete(id);
  void url?.then((u) => u && URL.revokeObjectURL(u));
}

async function probe(file: Blob, kind: MediaKind): Promise<Partial<Media>> {
  if (kind === 'image') {
    const bitmap = await createImageBitmap(file);
    const out = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return out;
  }
  const url = URL.createObjectURL(file);
  try {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    el.muted = true;
    el.src = url;
    await new Promise<void>((resolve, reject) => {
      el.onloadedmetadata = () => resolve();
      el.onerror = () => reject(new Error('cannot decode'));
      setTimeout(() => reject(new Error('timeout')), 10_000);
    });
    const out: Partial<Media> = {
      duration: Number.isFinite(el.duration) ? el.duration : undefined,
    };
    if (el instanceof HTMLVideoElement && el.videoWidth) {
      out.width = el.videoWidth;
      out.height = el.videoHeight;
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Check that a stored media file exists, has the expected size and decodes. */
export async function verifyMedia(media: Media): Promise<string | null> {
  const file = await mediaFile(media.id);
  if (!file) return 'missing from this machine';
  if (file.size !== media.size) return `size mismatch (${file.size} vs ${media.size} bytes)`;
  try {
    await probe(file.slice(0, file.size, media.mime), media.kind);
    return null;
  } catch {
    return 'cannot be decoded by this browser';
  }
}
