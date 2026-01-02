import { ReactNode } from 'react';
import { X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BatchActionBarProps {
  selectedCount: number;
  onDeselectAll: () => void;
  children: ReactNode;
  className?: string;
}

export function BatchActionBar({
  selectedCount,
  onDeselectAll,
  children,
  className,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'bg-background border border-border rounded-xl shadow-lg',
        'px-4 py-3 flex items-center gap-4',
        'animate-in slide-in-from-bottom-4 duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckSquare className="w-4 h-4 text-primary" />
        <span>已選擇 {selectedCount} 項</span>
      </div>
      
      <div className="h-6 w-px bg-border" />
      
      <div className="flex items-center gap-2">
        {children}
      </div>
      
      <div className="h-6 w-px bg-border" />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={onDeselectAll}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4 mr-1" />
        取消選擇
      </Button>
    </div>
  );
}
