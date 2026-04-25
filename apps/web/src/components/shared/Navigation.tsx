'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CheckSquare,
  MessageSquare,
  Image as ImageIcon,
  Heart,
  Activity,
  Gift,
  Trophy,
  AlertTriangle,
  Settings,
  Menu,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const allNavItems = [
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, key: 'tasks' },
  { name: 'Chat', href: '/chat', icon: MessageSquare, key: 'chat' },
  { name: 'Gallery', href: '/gallery', icon: ImageIcon, key: 'gallery' },
  { name: 'Wishes', href: '/wishes', icon: Heart, key: 'wishes' },
  { name: 'Monitoring', href: '/monitoring', icon: Activity, key: 'monitoring' },
  { name: 'Rewards', href: '/rewards', icon: Gift, key: 'rewards' },
  { name: 'Achievements', href: '/achievements', icon: Trophy, key: 'achievements' },
  { name: 'Punishments', href: '/punishments', icon: AlertTriangle, key: 'punishments' },
];

export default function Navigation({ userConfig, userRole }: { userConfig?: any, userRole?: string }) {
  const pathname = usePathname();

  // Filter items based on app_config if user is a sub
  const navItems = userRole === 'dom' || !userConfig ? allNavItems : allNavItems.filter(item => {
    // Default to true if not specified in config
    if (!userConfig[item.key]) return true;
    return userConfig[item.key].enabled;
  });

  const renderNavLinks = () => (
    <div className="flex flex-col space-y-1 w-full">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
              isActive 
                ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]' 
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'group-hover:text-white'}`} />
            <span className="font-medium">{item.name}</span>
          </Link>
        );
      })}

      <div className="pt-8 pb-2">
        <div className="h-px w-full bg-border"></div>
      </div>

      <Link
        href="/settings"
        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${pathname.startsWith('/settings')
          ? 'bg-primary/10 text-primary font-bold shadow-[0_0_10px_rgba(255,31,87,0.2)] inset-0 border border-primary/20'
          : 'text-muted hover:bg-secondary hover:text-foreground'
          }`}
      >
        <Settings className={`w-5 h-5 ${pathname.startsWith('/settings') ? 'text-primary' : 'text-muted group-hover:text-foreground'}`} />
        <span>Settings</span>
      </Link>

      {userRole === 'dom' && (
        <Link
          href="/superadmin"
          className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group mt-2 ${pathname.startsWith('/superadmin')
            ? 'bg-blue-900/50 text-blue-400 font-bold border border-blue-800'
            : 'text-muted hover:bg-blue-900/20 hover:text-blue-400'
            }`}
        >
          <Shield className={`w-5 h-5 ${pathname.startsWith('/superadmin') ? 'text-blue-400' : 'text-muted group-hover:text-blue-400'}`} />
          <span>Superadmin</span>
        </Link>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border glass-card sticky top-0 z-50 w-full">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(255,31,87,0.5)]">
            <span className="text-primary-foreground font-black text-sm">D<span>s</span></span>
          </div>
          <span className="font-black tracking-tight text-lg">Maietek</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-foreground">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 glass-card border-r-border">
              <div className="flex flex-col h-full bg-background/80 p-6">
              <div className="flex items-center space-x-2 mb-8">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(255,31,87,0.5)]">
                  <span className="text-primary-foreground font-black text-sm">D<span>s</span></span>
                </div>
                <span className="font-black tracking-tight text-xl">Maietek</span>
              </div>
              {renderNavLinks()}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen glass-card border-r border-border shrink-0">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(255,31,87,0.5)]">
              <span className="text-primary-foreground font-black">D<span>s</span></span>
            </div>
            <span className="font-black tracking-tight text-2xl">Maietek</span>
          </div>
          {renderNavLinks()}
        </div>
      </aside>
    </>
  );
}