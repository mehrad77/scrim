import type { Media } from '@scrim/format';
import { FileAudio, FileImage, FileVideo, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatBytes, formatClock } from '../../lib/clock.js';
import { cn } from '../../lib/cn.js';
import { layerForMedia } from '../../lib/layers.js';
import { removeLayer } from '../../lib/refs.js';
import { useEditor, useShow } from '../../state/editor.js';
import { addMediaFile, deleteMediaFile } from '../../storage/media.js';
import { listShows } from '../../storage/shows.js';
import { IconButton } from '../../ui/Button.js';
import { confirmDialog } from '../../ui/dialog.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { errorToast } from '../../ui/toast.js';

const icons = { image: FileImage, video: FileVideo, audio: FileAudio };

export function MediaPanel() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  const outputId = useEditor((s) => s.selection.outputId);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [over, setOver] = useState(false);

  const upload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      setUploading((u) => [...u, file.name]);
      try {
        const media = await addMediaFile(file);
        update((d) => void d.media.push(media));
      } catch (e) {
        errorToast(e);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
  };

  const place = (media: Media) => {
    const output = show.outputs.find((o) => o.id === outputId) ?? show.outputs[0];
    const layer = layerForMedia(show, output, media);
    update((d) => void d.layers.push(layer));
    select({ layerId: layer.id });
  };

  const remove = async (media: Media) => {
    const users = show.layers.filter((l) => 'mediaId' in l && l.mediaId === media.id);
    if (
      !(await confirmDialog(
        'Remove media?',
        <>
          “{media.name}”{users.length ? ` and ${users.length} layer(s) using it` : ''} will be
          removed from this show.
        </>,
        'Remove',
        true,
      ))
    )
      return;
    update((d) => {
      d.media = d.media.filter((m) => m.id !== media.id);
      for (const l of users) removeLayer(d, l.id);
    });
    const others = (await listShows()).filter((s) => s.id !== show.id);
    if (!others.some((s) => s.media.some((m) => m.id === media.id)))
      await deleteMediaFile(media.id);
  };

  return (
    <Panel
      title="Media"
      actions={
        <IconButton
          label="Add media files"
          icon={<Upload size={14} />}
          onClick={() => input.current?.click()}
        />
      }
      className={cn(over && 'border-rose-400')}
      bodyClassName="p-1"
    >
      <div
        className="min-h-24"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          hidden
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
        {show.media.length === 0 && uploading.length === 0 && (
          <Empty>
            Drop images, video or audio here.
            <br />
            Files stay on this machine.
          </Empty>
        )}
        <ul>
          {show.media.map((m) => {
            const Icon = icons[m.kind];
            return (
              <li
                key={m.id}
                className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-ink-800"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/x-scrim-media', m.id)}
              >
                <Icon size={15} className="shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{m.name}</div>
                  <div className="text-[11px] text-ink-400">
                    {formatBytes(m.size)}
                    {m.duration ? ` · ${formatClock(m.duration)}` : ''}
                    {m.width ? ` · ${m.width}×${m.height}` : ''}
                  </div>
                </div>
                <IconButton
                  label={m.kind === 'audio' ? 'Add as sound' : 'Place on stage'}
                  icon={<Plus size={14} />}
                  onClick={() => place(m)}
                />
                <IconButton
                  label="Remove"
                  icon={<Trash2 size={13} />}
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => void remove(m)}
                />
              </li>
            );
          })}
          {uploading.map((n) => (
            <li key={n} className="px-2 py-1.5 text-sm text-ink-400">
              Adding {n}…
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

export function useDropMedia() {
  const show = useShow();
  const update = useEditor((s) => s.update);
  const select = useEditor((s) => s.select);
  return (mediaId: string, outputId: string) => {
    const media = show.media.find((m) => m.id === mediaId);
    const output = show.outputs.find((o) => o.id === outputId);
    if (!media || !output) return;
    const layer = layerForMedia(show, output, media);
    update((d) => void d.layers.push(layer));
    select({ layerId: layer.id });
  };
}
