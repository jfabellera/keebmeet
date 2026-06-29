import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';
import { FaCircle } from 'react-icons/fa';

export interface MeetupCapacityStatusProps {
  available: number;
  total: number;
  ended?: boolean;
}

export const MeetupCapacityStatus = ({
  available,
  total,
  ended,
}: MeetupCapacityStatusProps): ReactNode => {
  if (ended === true) {
    const attended = total - available;
    return (
      <div className="flex items-center gap-2">
        <p>
          {attended} of {total} attended
        </p>
      </div>
    );
  }

  let statusColor: string;
  const capacityRatio = available / total;

  if (capacityRatio > 0.4) {
    statusColor = 'text-green-500';
  } else if (capacityRatio > 0.1) {
    statusColor = 'text-yellow-500';
  } else {
    statusColor = 'text-red-500';
  }

  return (
    <div className="flex items-center gap-2">
      <FaCircle className={cn('size-3', statusColor)} />
      <p>
        {available} of {total} available
      </p>
    </div>
  );
};
