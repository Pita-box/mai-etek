import React from 'react';
import { getTasks } from '@/actions/tasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
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
  // Fetch user role - assuming it's in the raw_user_meta_data or we need to query users table
  // For now, let's assume 'dom' to show the create button, ideally fetch from db
  const { data: userData } = await supabase.from('users').select('role').eq('id', user?.id).single();
  const role = userData?.role || 'sub';

  const tasks = await getTasks();

  const activeTasks = tasks.filter(t => ['pending', 'in_progress'].includes(t.status));
  const reviewTasks = tasks.filter(t => t.status === 'submitted' || t.status === 'in_review');
  const completedTasks = tasks.filter(t => ['completed', 'approved', 'rejected'].includes(t.status));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Úkoly</h1>
          <p className="text-gray-400 mt-1">Správa a plnění tvých povinností.</p>
        </div>
        
        {role === 'dom' && (
          <Link 
            href="/tasks/new"
            className="flex items-center gap-2 bg-primary text-black px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Vytvořit úkol
          </Link>
        )}
      </div>

      {reviewTasks.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Ke kontrole ({reviewTasks.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviewTasks.map(task => (
              <TaskCard key={task.id} task={task} role={role} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          Aktivní ({activeTasks.length})
        </h2>
        {activeTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTasks.map(task => (
              <TaskCard key={task.id} task={task} role={role} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-glass-panel border border-glass-border rounded-xl">
            <p className="text-gray-400">Nemáš žádné aktivní úkoly. Užij si klid.</p>
          </div>
        )}
      </section>

      {completedTasks.length > 0 && (
        <section className="opacity-70">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Dokončené
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedTasks.slice(0, 6).map(task => ( // Show only recent completed
              <TaskCard key={task.id} task={task} role={role} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
