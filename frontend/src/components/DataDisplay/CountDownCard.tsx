import dayjs, { type Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
dayjs.extend(duration);

const convertToSmallestUnitOfTime = (
  durationMs: number
): { amount: number; unit: string } => {
  const duration = dayjs.duration(Math.abs(durationMs));
  const days = Math.floor(duration.asDays());
  const hours = Math.floor(duration.asHours());
  const minutes = Math.floor(duration.asMinutes());
  const seconds = Math.floor(duration.asSeconds());

  if (days > 0) return { amount: days, unit: `day${days > 1 ? 's' : ''}` };
  if (hours > 0) return { amount: hours, unit: `hour${hours > 1 ? 's' : ''}` };
  if (minutes > 0)
    return { amount: minutes, unit: `minute${minutes > 1 ? 's' : ''}` };
  return { amount: seconds, unit: `second${seconds > 1 ? 's' : ''}` };
};

interface CountDownProps extends React.ComponentProps<'div'> {
  date: Date | Dayjs;
  futureText: string;
  pastText: string;
  simple?: boolean;
}

const CountDown = ({
  date,
  futureText,
  pastText,
  simple,
  className,
  ...rest
}: CountDownProps): ReactNode => {
  const [durationMs, setDurationMs] = useState<number>(dayjs(date).diff());

  const { amount, unit } = useMemo(
    () => convertToSmallestUnitOfTime(durationMs),
    [durationMs]
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      setDurationMs(dayjs(date).diff());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      className={cn(
        'bg-card text-card-foreground rounded-md p-4 shadow-sm',
        className
      )}
      {...rest}
    >
      <div className="flex flex-col items-center">
        <div className="flex items-baseline gap-2">
          {simple != null && simple ? (
            <>
              <span className="text-4xl font-medium">{amount}</span>
              <span className="text-sm font-normal">{unit.toUpperCase()}</span>
            </>
          ) : (
            <span className="text-4xl font-medium">
              {dayjs.duration(Math.abs(durationMs)).format('HH:mm:ss')}
            </span>
          )}
        </div>
        <p className="text-center text-xs">
          {durationMs > 0 ? futureText.toUpperCase() : pastText.toUpperCase()}
        </p>
      </div>
    </div>
  );
};

export default CountDown;
