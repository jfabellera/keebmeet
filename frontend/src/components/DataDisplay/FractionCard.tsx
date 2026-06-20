import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FractionCardProps extends React.ComponentProps<'div'> {
  numerator: number;
  denominator: number;
  label?: string;
}

const FractionCard = ({
  numerator,
  denominator,
  label,
  className,
  ...rest
}: FractionCardProps): ReactNode => {
  return (
    <div
      className={cn(
        'bg-card text-card-foreground rounded-md p-4 shadow-sm',
        className
      )}
      {...rest}
    >
      <div className="flex flex-col items-center">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-medium">{numerator}</span>
          <span className="text-xl">/</span>
          <span className="text-xl">{denominator}</span>
        </div>
        {label != null ? (
          <p className="text-xs">{label.toUpperCase()}</p>
        ) : null}
      </div>
    </div>
  );
};

export default FractionCard;
