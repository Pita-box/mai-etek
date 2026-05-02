type TypingIndicatorProps = {
  userName?: string | null;
};

export function TypingIndicator({ userName }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-2">
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-slate-400">
        {userName ? `${userName} píše…` : 'Píše…'}
      </span>
    </div>
  );
}
