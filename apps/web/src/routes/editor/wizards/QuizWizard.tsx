import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { buildQuiz } from '../../../lib/build/quiz.js';
import { cn } from '../../../lib/cn.js';
import { Button, IconButton } from '../../../ui/Button.js';
import { formDialog } from '../../../ui/dialog.js';
import { Field, NumberInput, TextInput } from '../../../ui/Field.js';
import { toast } from '../../../ui/toast.js';
import { Actions, Form } from '../recipes.js';
import { build, current, Group, OutputField } from './parts.js';

interface Answers {
  question: string;
  options: string[];
  correct: number;
  seconds: number;
  points: number;
  outputId: string;
}

function QuizForm({ done }: { done: (a: Answers | null) => void }) {
  const [a, setA] = useState<Answers>({
    question: 'What is the capital of Australia?',
    options: ['Sydney', 'Canberra', 'Melbourne'],
    correct: 1,
    seconds: 20,
    points: 1,
    outputId: current().outputs[0]?.id ?? '',
  });
  return (
    <Form onSubmit={() => done(a)}>
      <Field label="The question">
        <TextInput
          autoFocus
          value={a.question}
          onChange={(e) => setA({ ...a, question: e.target.value })}
        />
      </Field>
      <Group legend="Answers, and which one is right">
        <div
          role="radiogroup"
          aria-label="The right answer"
          className="flex flex-col gap-1"
          onKeyDown={(e) => {
            // One tab stop; the arrow keys move the right answer, as in any radio group.
            const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
            if (!step || !(e.target as HTMLElement).matches('[role=radio]')) return;
            e.preventDefault();
            const correct = (a.correct + step + a.options.length) % a.options.length;
            setA({ ...a, correct });
            e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]')[correct]?.focus();
          }}
        >
          {a.options.map((o, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-1">
              <button
                type="button"
                role="radio"
                aria-checked={a.correct === i}
                tabIndex={a.correct === i ? 0 : -1}
                aria-label={`Answer ${i + 1} is right`}
                onClick={() => setA({ ...a, correct: i })}
                className={cn(
                  'h-control rounded-control border px-2 text-caption',
                  a.correct === i
                    ? 'border-fg bg-fg text-app'
                    : 'border-line-control text-fg-muted hover:bg-control-hover',
                )}
              >
                {a.correct === i ? 'Right' : i + 1}
              </button>
              <TextInput
                aria-label={`Answer ${i + 1}`}
                value={o}
                onChange={(e) =>
                  setA({ ...a, options: a.options.map((x, j) => (j === i ? e.target.value : x)) })
                }
              />
              <IconButton
                label={`Remove answer ${i + 1}`}
                icon={<Trash2 size={12} />}
                disabled={a.options.length <= 2}
                onClick={() =>
                  setA({
                    ...a,
                    options: a.options.filter((_, j) => j !== i),
                    correct: a.correct > i ? a.correct - 1 : a.correct === i ? 0 : a.correct,
                  })
                }
              />
            </div>
          ))}
          {a.options.length < 6 && (
            <Button
              size="sm"
              className="w-fit"
              icon={<Plus size={12} />}
              onClick={() => setA({ ...a, options: [...a.options, ''] })}
            >
              Answer
            </Button>
          )}
        </div>
      </Group>
      <div className="grid grid-cols-[8rem_8rem_1fr] items-end gap-2">
        <Field label="Time to answer">
          <NumberInput
            value={a.seconds}
            min={5}
            suffix="s"
            onCommit={(seconds) => setA({ ...a, seconds })}
          />
        </Field>
        <Field label="Points">
          <NumberInput value={a.points} min={1} onCommit={(points) => setA({ ...a, points })} />
        </Field>
        <OutputField value={a.outputId} onChange={(outputId) => setA({ ...a, outputId })} />
      </div>
      <p className="text-caption text-fg-subtle">
        The room plays against the quizmaster: when time is up, the room’s answer scores for the
        room if it is right, and for the quizmaster if not. People without a phone can answer with
        buttons mapped to “Vote for option 1, 2…” in Controls.
      </p>
      <Actions
        ok="Add the question"
        onCancel={() => done(null)}
        disabled={!a.question.trim() || a.options.some((o) => !o.trim())}
      />
    </Form>
  );
}

export async function run(): Promise<void> {
  const a = await formDialog<Answers>('Quiz question', (done) => <QuizForm done={done} />, true);
  if (!a) return;
  const made = build((d) =>
    buildQuiz(d, { ...a, question: a.question.trim(), options: a.options.map((o) => o.trim()) }),
  );
  if (!made) return;
  toast('Question added: ask, reveal and clear, with the score on stage', 'good');
}
