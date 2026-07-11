import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeftIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to: string;
  label: string;
  className?: string;
}

export const BackButton = ({
  to,
  label,
  className,
}: BackButtonProps): ReactNode => {
  const navigate = useNavigate();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => {
        void navigate(to);
      }}
      className={cn('size-11', className)}
    >
      <ArrowLeftIcon className="size-6" />
    </Button>
  );
};

export default BackButton;
