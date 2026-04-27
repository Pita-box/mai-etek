import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getTask } from '@/actions/tasks';
import { TaskDetailPageClient } from '@/components/tasks/TaskDetailPageClient';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await params;
  const task = await getTask(taskId);

  if (!task) {
    return <div className="p-6 max-w-4xl mx-auto text-white">Úkol nenalezen.</div>;
  }

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
  const role = profileData?.role === 'dom' ? 'dom' : 'sub';

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 text-white md:p-8">
      <Link
        href="/tasks"
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Zpět na úkoly
      </Link>

      <TaskDetailPageClient task={task} role={role} />
    </main>
  );
}
