const dateFormatter = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) return 'Dnes';
  if (target.getTime() === yesterday.getTime()) return 'Včera';
  return dateFormatter.format(date);
}

type DateSeparatorProps = {
  date: string;
};

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
        {formatDateLabel(date)}
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
