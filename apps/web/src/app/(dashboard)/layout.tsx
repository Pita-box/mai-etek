'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Header from '@/components/shared/Header';
import Navigation from '@/components/shared/Navigation';
import LockScreen from '@/components/LockScreen';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setProfile(profileData);
      setLoading(false);
    };

    checkUser();
  }, [router, supabase]);

  if (loading) return <div className='text-white p-4 center items-center content-center'>Načítám...</div>;

  // Show Lock Screen for unassigned users
  if (profile?.role === 'unassigned') {
    return <LockScreen />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Navigation userConfig={profile?.app_config} userRole={profile?.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}