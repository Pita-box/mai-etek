'use client';

import Link from 'next/link';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { markAllNotificationsRead, markNotificationRead } from '@/actions/notifications';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { getTaskHref } from '@/lib/tasks/ids';
import { useNotificationsRealtime } from './useNotificationsRealtime';

const dateFormatter = new Intl.DateTimeFormat('cs-CZ', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function NotificationsPopover() {
  const { notifications, unreadCount, isRealtimeSyncing, refreshNotifications } = useNotificationsRealtime();

  const handleMarkAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (!result?.error) {
      await refreshNotifications();
    }
  };

  const handleMarkRead = async (notificationId: string, isUnread: boolean) => {
    if (!isUnread) return;
    const result = await markNotificationRead(notificationId);
    if (!result?.error) {
      await refreshNotifications();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative text-muted hover:text-foreground hover:bg-secondary rounded-full" />}> 
        <Bell className="w-5 h-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black leading-none text-black shadow-[0_0_12px_rgba(255,31,87,0.55)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={10} className="w-[24rem] rounded-3xl border border-white/10 bg-zinc-950/95 p-0 text-white shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Notifikace</p>
            <p className="mt-1 text-xs text-zinc-400">
              {unreadCount > 0 ? `${unreadCount} nepřečtených` : 'Všechno máš přečtené'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isRealtimeSyncing ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0}
              className="h-8 rounded-full px-3 text-xs text-zinc-300 hover:bg-white/5 hover:text-white disabled:opacity-40"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Označit vše
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator className="bg-white/10" />

        <div className="max-h-[28rem] overflow-y-auto p-2">
          {notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const isUnread = !notification.readAt;
                const href = notification.taskId ? getTaskHref({ id: notification.taskId }) : null;

                return (
                  <div
                    key={notification.id}
                    className={`rounded-2xl border p-3 transition ${isUnread ? 'border-primary/30 bg-primary/8' : 'border-white/8 bg-white/[0.03]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">{notification.title}</p>
                          {isUnread ? <Badge variant="default" className="h-5 px-1.5 text-[10px]">Nové</Badge> : null}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-zinc-300">{notification.body}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                          <span>{dateFormatter.format(new Date(notification.createdAt))}</span>
                          {notification.actorName ? <span>• {notification.actorName}</span> : null}
                          <span>• {notification.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      {href ? (
                        <Link
                          href={href}
                          onClick={() => void handleMarkRead(notification.id, isUnread)}
                          className="inline-flex h-8 items-center rounded-full border border-white/10 px-3 text-xs font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                        >
                          Otevřít úkol
                        </Link>
                      ) : <span />}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleMarkRead(notification.id, isUnread)}
                        disabled={!isUnread}
                        className="h-8 rounded-full px-3 text-xs text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                      >
                        Označit jako přečtené
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
              <p className="text-sm font-medium text-zinc-300">Zatím žádné notifikace</p>
              <p className="mt-1 text-xs text-zinc-500">Až někdo něco udělá v task workflow, objeví se to tady.</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
