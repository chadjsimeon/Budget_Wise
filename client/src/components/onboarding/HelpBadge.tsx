import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStore } from '@/lib/store';

interface HelpBadgeProps {
  content: string;
  title?: string;
  next?: string;
}

export function HelpBadge({ content, title, next }: HelpBadgeProps) {
  const helpModeEnabled = useStore((s) => s.helpModeEnabled);

  if (!helpModeEnabled) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <sup>
          <button className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 text-[10px] font-bold transition-colors cursor-pointer leading-none align-super">
            ?
          </button>
        </sup>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" side="top">
        {title && <p className="font-semibold mb-1 text-slate-900">{title}</p>}
        <p className="text-slate-600 leading-relaxed">{content}</p>
        {next && (
          <p className="text-blue-600 mt-2 text-xs font-medium border-t border-slate-100 pt-2">
            Next: {next}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
