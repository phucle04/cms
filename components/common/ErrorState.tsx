import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn('py-12 flex flex-col items-center gap-3 text-center', className)}>
      <AlertTriangle className="text-destructive" size={28} />
      <p className="text-foreground">{message || 'Có lỗi xảy ra. Vui lòng thử lại.'}</p>
      {onRetry && <Button onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}
