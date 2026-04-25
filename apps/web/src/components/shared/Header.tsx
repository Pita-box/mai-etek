'use client';

import { usePathname } from 'next/navigation';
import { Bell, AlertOctagon, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header() {
  const pathname = usePathname();
  
  // Create a title based on the pathname
  const getPageTitle = () => {
    const path = pathname.split('/')[1];
    if (!path) return 'Dashboard';
    return path.charAt(0).toUpperCase() + path.slice(1);
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
        
        <Button variant="ghost" size="icon" className="relative text-muted hover:text-foreground hover:bg-secondary rounded-full">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full shadow-[0_0_5px_rgba(255,31,87,0.8)]"></span>
        </Button>
        
        {/* User Profile Placeholder */}
        <Button variant="ghost" size="icon" className="rounded-full bg-secondary overflow-hidden border border-border">
          <User className="w-5 h-5 text-muted" />
        </Button>
      </div>
    </header>
  );
}