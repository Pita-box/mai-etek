import React from 'react';
import { getTask, updateTask } from '@/actions/tasks';
import { PriorityBadge, TaskStatusBadge } from '@/components/tasks/Badges';
import { EvidenceUpload } from '@/components/tasks/EvidenceUpload';
import { DOMApproval } from '@/components/tasks/DOMApproval';
import { Calendar, Award, ArrowLeft, PlayCircle, Clock, Star } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import Link from 'next/link';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  // Extract id directly, not via 'await params' to match standard server component signature
  const taskId = params.id;
  const task = await getTask(taskId);
  
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { data: userData } = await supabase.from('users').select('role').eq('id', user?.id).single();
  const role = userData?.role || 'sub';

  // Fetch Evidence if task is submitted or later
  let evidence = null;
  if (['submitted', 'in_review', 'approved', 'rejected'].includes(task.status)) {
    const { data } = await supabase.from('task_evidence').select('*').eq('task_id', task.id).single();
    evidence = data;
  }

  // Action to start task (Server action directly in component for simplicity in Next 14+)
  async function startTaskAction() {
    'use server';
    const formData = new FormData();
    formData.append('status', 'in_progress');
    await updateTask(taskId, formData);
    revalidatePath(`/tasks/${taskId}`);
  }

  const isSub = role === 'sub';
  const isDom = role === 'dom';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/tasks" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-2 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Zpět na úkoly
      </Link>

      <div className="bg-glass-panel border border-glass-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-glass-border">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-3 items-center">
              <TaskStatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
            {task.points_reward > 0 && (
              <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-medium">
                <Award className="w-5 h-5" />
                <span>+{task.points_reward} bodů</span>
              </div>
            )}
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2">{task.title}</h1>
          
          <div className="flex items-center gap-4 text-sm text-gray-400">
            {task.deadline && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Termín: {format(new Date(task.deadline), 'PPp', { locale: cs })}</span>
              </div>
            )}
            {task.recurrence !== 'none' && (
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded text-xs">
                Opakování: {task.recurrence}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="p-8">
          <h2 className="text-lg font-semibold text-white mb-4">Instrukce</h2>
          <div className="prose prose-invert max-w-none text-gray-300">
            {task.description ? (
              <p className="whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="italic text-gray-500">Bez bližších instrukcí.</p>
            )}
          </div>
        </div>
      </div>

      {/* SUB Actions: Start Task */}
      {isSub && task.status === 'pending' && (
        <form action={startTaskAction}>
          <button type="submit" className="w-full flex items-center justify-center gap-2 bg-primary text-black font-bold text-lg py-4 rounded-xl hover:bg-primary/90 transition-transform active:scale-[0.99] shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]">
            <PlayCircle className="w-6 h-6" /> Začít plnit úkol
          </button>
        </form>
      )}

      {/* SUB Actions: Upload Evidence */}
      {isSub && task.status === 'in_progress' && (
        <EvidenceUpload taskId={task.id} />
      )}

      {/* Waiting for review info for SUB */}
      {isSub && task.status === 'submitted' && (
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 p-6 rounded-xl flex items-center gap-4">
          <Clock className="w-8 h-8" />
          <div>
            <h3 className="font-semibold text-lg">Čeká na schválení</h3>
            <p className="text-blue-400/80">Odeslal jsi důkaz. Nyní musí tvůj Dom úkol zkontrolovat a schválit.</p>
          </div>
        </div>
      )}

      {/* Evidence Display (Visible to both if it exists) */}
      {evidence && (
        <div className="bg-glass-panel border border-glass-border rounded-xl p-6 mt-6">
          <h3 className="text-xl font-medium text-white mb-4">Předložený důkaz</h3>
          
          <div className="bg-black/30 rounded-lg p-4 border border-white/5">
            <div className="text-sm text-gray-500 mb-2">Typ: {evidence.type.toUpperCase()}</div>
            
            {evidence.type === 'text' ? (
              <p className="text-white whitespace-pre-wrap">{evidence.content}</p>
            ) : evidence.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={evidence.content} alt="Důkaz" className="max-w-full rounded-md border border-glass-border" />
            ) : evidence.type === 'video' ? (
              <a href={evidence.content} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-2">
                <PlayCircle className="w-5 h-5" /> Otevřít video důkaz
              </a>
            ) : null}
          </div>
        </div>
      )}

      {/* DOM Actions: Review/Approve */}
      {isDom && (task.status === 'submitted' || task.status === 'in_review') && (
        <DOMApproval taskId={task.id} />
      )}

      {/* Final State Info (Approved/Rejected) */}
      {(task.status === 'approved' || task.status === 'rejected') && (
        <div className={`p-6 rounded-xl mt-6 border ${task.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <h3 className={`text-xl font-medium mb-2 ${task.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}`}>
            {task.status === 'approved' ? 'Úkol byl schválen' : 'Úkol byl zamítnut'}
          </h3>
          
          {task.rating && (
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className={`w-5 h-5 ${task.rating! >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
              ))}
            </div>
          )}
          
          {task.dom_feedback && (
            <div className="mt-2 text-white bg-black/20 p-4 rounded-lg">
              <span className="text-xs text-gray-400 block mb-1">Zpětná vazba:</span>
              <p className="italic">&quot;{task.dom_feedback}&quot;</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
