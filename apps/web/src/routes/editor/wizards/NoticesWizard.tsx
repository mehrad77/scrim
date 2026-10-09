import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { buildNotices, type Notice } from '../../../lib/build/notices.js';
import { Button, IconButton } from '../../../ui/Button.js';
import { formDialog } from '../../../ui/dialog.js';
import { Field, NumberInput, TextInput, Toggle } from '../../../ui/Field.js';
import { toast } from '../../../ui/toast.js';
import { Actions, Form } from '../recipes.js';
import { build, current, Group, OutputField } from './parts.js';

interface Answers {
  notices: Notice[];
  seconds: number;
  loop: boolean;
  outputId: string;
}

function NoticesForm({ done }: { done: (a: Answers | null) => void }) {
  const [a, setA] = useState<Answers>({
    notices: [
      { title: 'Welcome', body: 'Please switch your phone to silent' },
      { title: 'After the service', body: 'Tea and coffee in the hall' },
    ],
    seconds: 8,
    loop: true,
    outputId: current().outputs[0]?.id ?? '',
  });
  const setNotice = (i: number, patch: Partial<Notice>) =>
    setA({ ...a, notices: a.notices.map((n, j) => (j === i ? { ...n, ...patch } : n)) });
  return (
    <Form onSubmit={() => done(a)}>
      <Group legend="Each notice: a title, and a line under it">
        <div className="flex flex-col gap-1">
          {a.notices.map((n, i) => (
            <div key={i} className="grid grid-cols-[12rem_1fr_auto] gap-1">
              <TextInput
                autoFocus={i === 0}
                aria-label={`Notice ${i + 1} title`}
                value={n.title}
                onChange={(e) => setNotice(i, { title: e.target.value })}
              />
              <TextInput
                aria-label={`Notice ${i + 1} text`}
                value={n.body}
                onChange={(e) => setNotice(i, { body: e.target.value })}
              />
              <IconButton
                label={`Remove notice ${i + 1}`}
                icon={<Trash2 size={12} />}
                disabled={a.notices.length <= 1}
                onClick={() => setA({ ...a, notices: a.notices.filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <Button
            size="sm"
            className="w-fit"
            icon={<Plus size={12} />}
            onClick={() => setA({ ...a, notices: [...a.notices, { title: '', body: '' }] })}
          >
            Notice
          </Button>
        </div>
      </Group>
      <div className="grid grid-cols-[8rem_1fr] items-end gap-2">
        <Field label="Each stays up">
          <NumberInput
            value={a.seconds}
            min={2}
            suffix="s"
            onCommit={(seconds) => setA({ ...a, seconds })}
          />
        </Field>
        <OutputField value={a.outputId} onChange={(outputId) => setA({ ...a, outputId })} />
      </div>
      <Toggle
        checked={a.loop}
        onChange={(loop) => setA({ ...a, loop })}
        label="Go round again after the last one; “next scene” ends them"
      />
      <Actions
        ok="Add notices"
        onCancel={() => done(null)}
        disabled={a.notices.every((n) => !n.title.trim() && !n.body.trim())}
      />
    </Form>
  );
}

export async function run(): Promise<void> {
  const a = await formDialog<Answers>('Notices', (done) => <NoticesForm done={done} />, true);
  if (!a) return;
  const notices = a.notices
    .map((n) => ({ title: n.title.trim(), body: n.body.trim() }))
    .filter((n) => n.title || n.body);
  if (!build((d) => buildNotices(d, { ...a, notices }))) return;
  toast(`${notices.length} notices added: GO starts them, and they change on their own`, 'good');
}
