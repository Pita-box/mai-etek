'use client';

import { Heart, Pencil, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { addTaskComment, getTaskComments, updateTaskComment, deleteTaskComment, toggleTaskCommentLike } from '@/actions/tasks';
import { createClient } from '@/utils/supabase/client';
import { EvidenceTab } from './TaskEvidenceTabs';

type TaskCommentsThreadProps = {
  taskId: string;
  tabType: EvidenceTab;
};

type TaskCommentRole = "dom" | "sub" | "unassigned";

type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  author_role: TaskCommentRole;
  tab_type: 'text' | 'photos' | 'videos';
  body: string;
  can_edit: boolean;
  can_delete: boolean;
  liked_by_me: boolean;
  like_count: number;
  is_edited: boolean;
  created_at: string;
};

const dateFormatter = new Intl.DateTimeFormat('cs-CZ', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function TaskCommentsThread(props: TaskCommentsThreadProps) {
  return <TaskCommentsThreadInner key={`${props.taskId}-${props.tabType}`} {...props} />;
}

function TaskCommentsThreadInner({ taskId, tabType }: TaskCommentsThreadProps) {
  const [body, setBody] = useState('');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const loadComments = useCallback(async () => {
    const result = await getTaskComments(taskId, tabType);
    if (result.error) {
      setError(result.error);
      setComments([]);
    } else {
      const nextComments = ((result.comments as TaskComment[]) || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setError(null);
      setComments(nextComments);
    }
    setIsLoading(false);
  }, [taskId, tabType]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const result = await getTaskComments(taskId, tabType);
      if (!active) return;
      if (result.error) {
        setError(result.error);
        setComments([]);
      } else {
        const nextComments = ((result.comments as TaskComment[]) || []).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setError(null);
        setComments(nextComments);
      }
      setIsLoading(false);
    };

    void run();

    const supabase = createClient();
    const channel = supabase
      .channel(`task-comments-${taskId}-${tabType}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_comments',
        filter: `task_id=eq.${taskId}`,
      }, (payload) => {
        const next = payload.new as { tab_type?: string } | null;
        const previous = payload.old as { tab_type?: string } | null;
        if (next?.tab_type === tabType || previous?.tab_type === tabType) {
          void loadComments();
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_comment_likes',
      }, () => {
        void loadComments();
      })
      .subscribe();

    const pollingInterval = setInterval(() => {
      void loadComments();
    }, 3000);

    return () => {
      active = false;
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [loadComments, taskId, tabType]);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const result = await addTaskComment(taskId, tabType, text);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setBody('');
      await loadComments();
    });
  };

  const submitEdit = (id: string) => {
    const text = editBody.trim();
    if (!text) return;
    startTransition(async () => {
      const result = await updateTaskComment(id, text);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditingId(null);
      await loadComments();
    });
  };

  const submitDelete = (id: string) => {
    if (!confirm('Opravdu smazat?')) return;
    startTransition(async () => {
      const result = await deleteTaskComment(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      await loadComments();
    });
  };

  const toggleLike = (id: string) => {
    const comment = comments.find(c => c.id === id);
    if (!comment || comment.can_edit) return;

    startTransition(async () => {
      const result = await toggleTaskCommentLike(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      await loadComments();
    });
  };

  return (
    <div className="border-t border-white/10 pt-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="font-bold text-white">Komentáře</h4>

        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Načítám komentáře…</p>
        ) : comments.length > 0 ? (
          comments.map((comment) => (
            <article key={comment.id} className="rounded-2xl bg-black/25 p-3 ring-1 ring-white/5">
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-bold ${comment.author_role === 'dom' ? 'text-primary' : comment.author_role === 'sub' ? 'text-blue-400' : 'text-zinc-300'}`}>
                    {comment.author_name}
                  </span>
                  <time dateTime={comment.created_at} className="text-zinc-500">{dateFormatter.format(new Date(comment.created_at))}</time>
                  {comment.is_edited && <span className="text-[10px] text-zinc-600">(upraveno)</span>}
                </div>

                <div className="flex items-center gap-2">
                  {comment.can_edit && editingId !== comment.id && (
                    <button onClick={() => { setEditingId(comment.id); setEditBody(comment.body); }} className="text-zinc-500 hover:text-white transition">
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  {comment.can_delete && (
                    <button onClick={() => submitDelete(comment.id)} disabled={isPending} className="text-zinc-500 hover:text-red-400 transition">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {editingId === comment.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px] max-h-[60svh] resize-y"
                    rows={4}
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1 text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition">Zrušit</button>
                    <button onClick={() => submitEdit(comment.id)} disabled={isPending || !editBody.trim()} className="rounded-lg bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed">Uložit</button>
                  </div>
                </div>
              ) : (
                <div className="mt-1">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{comment.body}</p>

                  <div className="mt-2 flex justify-end">
                    {(!comment.can_edit || comment.like_count > 0) && (
                      <button
                        onClick={() => toggleLike(comment.id)}
                        disabled={comment.can_edit}
                        className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition ${comment.liked_by_me
                          ? 'bg-red-500/10 text-red-400'
                          : comment.can_edit
                            ? 'text-zinc-500 cursor-default'
                            : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                          }`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${comment.liked_by_me ? 'fill-current' : ''}`} />
                        {comment.like_count > 0 && <span>{comment.like_count}</span>}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-2xl bg-black/20 p-4 text-sm text-zinc-500 ring-1 ring-white/5">K této záložce zatím nejsou žádné komentáře.</p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          id={`task-comment-input-${tabType}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          placeholder="Napsat komentář… (ENTER)"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          id={`task-comment-submit-${tabType}`}
          type="button"
          disabled={isPending || !body.trim()}
          onClick={submit}
          className="rounded-xl bg-primary px-4 py-3 text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

