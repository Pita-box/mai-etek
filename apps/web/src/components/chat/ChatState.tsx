import { cn } from '@/lib/utils';

type ChatStateProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  tone?: 'default' | 'error';
  className?: string;
};

export function ChatState({
  title,
  description,
  icon,
  tone = 'default',
  className,
}: ChatStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,31,87,0.14),transparent_40%),linear-gradient(180deg,rgba(0,0,0,0.78),rgba(0,0,0,0.94))] px-6 py-10 text-center backdrop-blur-xl',
        tone === 'error' && 'border-rose-500/30 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.14),transparent_40%),linear-gradient(180deg,rgba(0,0,0,0.78),rgba(0,0,0,0.94))]',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-primary/10 text-primary shadow-[0_0_40px_rgba(255,31,87,0.16)]">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-50">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}
