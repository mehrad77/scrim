import type { Media } from '@scrim/format';
import { FileAudio, MoreHorizontal, Plus, Replace, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatBytes, formatClock } from '../../lib/clock.js';
import { cn } from '../../lib/cn.js';
import { layerForMedia } from '../../lib/layers.js';
import { removeLayer } from '../../lib/refs.js';
import { fontFamilyOf } from '../../render/useShowFonts.js';
import { useMediaUrl } from '../../render/useMediaUrl.js';
import { useEditor, useShow } from '../../state/editor.js';
import { MenuButton } from '../../ui/Menu.js';
import { addMediaFile, deleteMediaFile } from '../../storage/media.js';
import { listShows } from '../../storage/shows.js';
import { IconButton } from '../../ui/Button.js';
import { confirmDialog } from '../../ui/dialog.js';
import { Empty, Panel } from '../../ui/Panel.js';
import { errorToast, toast } from '../../ui/toast.js';

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

  /** Swap one media file for another in every layer that uses it, keeping layout and crop. */
  const replaceEverywhere = async (from: Media, to: Media) => {
    const users = show.layers.filter((l) => 'mediaId' in l && l.mediaId === from.id);
    if (!users.length) return toast(`No layer uses “${from.name}”`);
    if (
      !(await confirmDialog(
        `Replace “${from.name}” everywhere?`,
        <>
          {users.length} layer{users.length === 1 ? '' : 's'} will show “{to.name}” instead, with
          their position and crop kept.
        </>,
        `Replace in ${users.length} layer${users.length === 1 ? '' : 's'}`,
      ))
    )
      return;
    update((d) => {
      for (const l of d.layers) if ('mediaId' in l && l.mediaId === from.id) l.mediaId = to.id;
    });
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
      className={cn(over && 'border-accent')}
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
          accept="image/*,video/*,audio/*,.woff,.woff2,.ttf,.otf"
          hidden
          onChange={(e) => e.target.files && void upload(e.target.files)}
        />
        {show.media.length === 0 && uploading.length === 0 && (
          <Empty>
            Drop images, video, audio or fonts here.
            <br />
            Files stay on this machine.
          </Empty>
        )}
        <ul className="grid grid-cols-2 gap-1">
          {show.media.map((m) => (
            <MediaTile
              key={m.id}
              media={m}
              onPlace={() => place(m)}
              onRemove={() => void remove(m)}
              onReplaceEverywhere={(other) => void replaceEverywhere(m, other)}
            />
          ))}
          {uploading.map((n) => (
            <li key={n} className="col-span-2 px-2 py-1.5 text-ui text-fg-subtle">
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

/** A media file as a thumbnail: drag it onto the stage, or onto a layer to replace that layer's media. */
function MediaTile({
  media: m,
  onPlace,
  onRemove,
  onReplaceEverywhere,
}: {
  media: Media;
  onPlace: () => void;
  onRemove: () => void;
  onReplaceEverywhere: (other: Media) => void;
}) {
  const show = useShow();
  const url = useMediaUrl(m.kind === 'image' || m.kind === 'video' ? m.id : undefined);
  const others = show.media.filter((x) => x.kind === m.kind && x.id !== m.id);
  return (
    <li
      className="group relative flex flex-col rounded-control border border-line-subtle bg-control"
      draggable={m.kind !== 'font'}
      onDragStart={(e) => e.dataTransfer.setData('application/x-scrim-media', m.id)}
      data-info={
        m.kind === 'font'
          ? `Font “${fontFamilyOf(m)}”: pick it for text layers`
          : 'Drag onto the stage, or onto a layer to replace its media'
      }
    >
      <div className="flex aspect-video items-center justify-center overflow-hidden bg-canvas">
        {m.kind === 'image' && url && (
          <img src={url} alt="" className="size-full object-contain" draggable={false} />
        )}
        {m.kind === 'video' && url && (
          <video
            src={`${url}#t=0.5`}
            muted
            preload="metadata"
            className="size-full object-contain"
          />
        )}
        {m.kind === 'audio' && <FileAudio size={20} className="text-fg-icon" />}
        {m.kind === 'font' && (
          <span className="text-heading text-fg" style={{ fontFamily: `"${fontFamilyOf(m)}"` }}>
            Aa
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-1 px-1.5 py-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-caption text-fg">{m.name}</div>
          <div className="truncate text-caption text-fg-subtle">
            {formatBytes(m.size)}
            {m.duration ? ` · ${formatClock(m.duration)}` : ''}
          </div>
        </div>
        {m.kind !== 'font' && (
          <IconButton
            label={m.kind === 'audio' ? 'Add as sound' : 'Place on stage'}
            icon={<Plus size={14} />}
            onClick={onPlace}
          />
        )}
        <MenuButton
          label={`More for ${m.name}`}
          icon={<MoreHorizontal size={14} />}
          className="w-7 px-0"
          items={[
            ...others.map((o) => ({
              id: `replace:${o.id}`,
              label: `Replace everywhere with ${o.name}`,
              icon: <Replace size={13} />,
              onAction: () => onReplaceEverywhere(o),
            })),
            ...(others.length ? (['separator'] as const) : []),
            {
              id: 'remove',
              label: 'Remove from show',
              icon: <Trash2 size={13} />,
              danger: true,
              onAction: onRemove,
            },
          ]}
        />
      </div>
    </li>
  );
}
