'use client';

import { useMemo, useState, useTransition } from 'react';
import { CheckCircle2, FileText, Loader2, Sparkles } from 'lucide-react';
import { saveTaskTextEvidence } from '@/actions/tasks';
import { Task } from '@/types/task';
import { hasRichTextContent, richTextToHtml } from '@/lib/task-rich-text';
import { TaskRichTextEditor } from './TaskRichTextEditor';

type TaskTextEvidenceProps = {
  task: Task;
  role: 'dom' | 'sub';
  onTaskMutated: () => Promise<void>;
};

export function TaskTextEvidence({ task, role, onTaskMutated }: TaskTextEvidenceProps) {
  const [isPending, startTransition] = useTransition();
  const attempts = task.task_attempts || [];
  const latestAttempt = attempts[0];
  const initialText = latestAttempt?.text_content || task.task_evidence?.find((item) => item.type === 'text')?.content || '';
  const [value, setValue] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const renderedHtml = useMemo(() => richTextToHtml(initialText), [initialText]);
  const hasContent = hasRichTextContent(initialText);
  const canSave = role === 'sub' && task.status !== 'in_review' && task.status !== 'completed';

  const handleSave = () => {
    if (!value.trim()) {
      setError('Textové odevzdání nemůže být prázdné.');
      setSaveMessage(null);
      return;
    }

    startTransition(async () => {
      setError(null);
      setSaveMessage(null);
      const result = await saveTaskTextEvidence(task.id, value);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaveMessage('Textové odevzdání bylo uloženo.');
      await onTaskMutated();
    });
  };

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 text-white">
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold">Textové odevzdání</h4>
            <p className="text-sm text-zinc-500">
              {role === 'sub'
                ? 'Sem napiš hlavní popis toho, jak jsi úkol splnil.'
                : 'Hlavní textové odevzdání od subíčka je připravené ke kontrole.'}
            </p>
          </div>
        </div>

        {role === 'dom' && (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Read only
          </div>
        )}

      </div>

      {role === 'sub' ? (
        <div className="space-y-4">
          <TaskRichTextEditor value={value} onChange={setValue} disabled={isPending || !canSave} />

          {!canSave ? (
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
              Tento úkol už byl odeslán ke kontrole nebo dokončen. Textové odevzdání je teď uzamčené.
            </div>
          ) : null}

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {saveMessage ? (
            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              {saveMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              id="task-text-evidence-save"
              type="button"
              onClick={handleSave}
              disabled={isPending || !canSave || !value.trim()}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Uložit textové odevzdání
            </button>
          </div>
        </div>
      ) : hasContent ? (
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center">
          <p className="text-sm text-zinc-500">SUB zatím nepřidal textové odevzdání.</p>
        </div>
      )}
    </div>
  );
}
