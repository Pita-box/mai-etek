import React from 'react';
import { getTasks } from '@/actions/tasks';
import { TasksClient } from '@/components/tasks/TasksClient';
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
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
  const role = profileData?.role === 'dom' ? 'dom' : 'sub';
  const tasks = await getTasks();

  return <TasksClient tasks={tasks} role={role} />;
}
