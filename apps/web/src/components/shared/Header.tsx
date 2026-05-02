'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertOctagon, Loader2, LogOut, Settings, User } from 'lucide-react';
import { NotificationsPopover } from '@/components/shared/NotificationsPopover';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { disconnectChatSocket } from '@/lib/socket';
import { createClient } from '@/utils/supabase/client';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Create a title based on the pathname
  const getPageTitle = () => {
    const path = pathname.split('/')[1];
    if (!path) return 'Dashboard';
    if (path === 'wishes') return 'Přání';
    if (path === 'gallery') return 'Galerie';
    if (path === 'rewards') return 'Odměny';
    if (path === 'achievements') return 'Úspěchy';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    disconnectChatSocket();
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsLoggingOut(false);
      return;
    }

    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-border glass-card sticky top-0 z-40 w-full">
      <div className="flex items-center">
        <h1 className="text-2xl font-black tracking-tight text-foreground">{getPageTitle()}</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Safe Word / Panic Button Placeholder */}
        <Button variant="destructive" size="sm" className="font-bold rounded-full px-4 flex items-center gap-2 shadow-[0_0_15px_rgba(255,0,0,0.4)] hover:shadow-[0_0_20px_rgba(255,0,0,0.6)] transition-all">
          <AlertOctagon className="w-4 h-4" />
          <span>Safe Word</span>
        </Button>
        
        <div className="w-px h-6 bg-border mx-2"></div>
        
        <NotificationsPopover />
        
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full bg-secondary overflow-hidden border border-border text-muted hover:border-primary/30 hover:bg-primary/10 hover:text-primary" />}>
            <User className="w-5 h-5" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={10} className="w-52 rounded-2xl border border-white/10 bg-zinc-950/95 p-2 text-white shadow-2xl backdrop-blur-xl">
            <DropdownMenuItem
              onClick={() => router.push('/settings')}
              className="cursor-pointer rounded-xl px-3 py-2 text-zinc-300 focus:bg-primary/10 focus:text-primary"
            >
              <Settings className="h-4 w-4" />
              Nastavení
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="cursor-pointer rounded-xl px-3 py-2 text-rose-200 focus:bg-rose-500/10 focus:text-rose-100 data-disabled:cursor-not-allowed"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Odhlásit se
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
