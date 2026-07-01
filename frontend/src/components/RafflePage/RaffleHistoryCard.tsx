import { type ReactNode } from 'react';
import dayjs from 'dayjs';
import RelativeTime from 'dayjs/plugin/relativeTime';
import { type RaffleRecordResponse } from '@keebmeet/shared';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

dayjs.extend(RelativeTime);

interface Props extends React.ComponentProps<'div'> {
  raffleRecord: RaffleRecordResponse;
  onCardClick: (raffleRecordId: number) => void;
}

const RaffleHistoryCard = ({
  raffleRecord,
  onCardClick,
  className,
  ...rest
}: Props): ReactNode => {
  const handleClick = (): void => {
    onCardClick(Number(raffleRecord.id)); // TODO(jan): id is actually a string
  };

  return (
    <div
      className={cn(
        'bg-card text-card-foreground w-full cursor-pointer rounded-md p-4 shadow-sm',
        className
      )}
      onClick={handleClick}
      {...rest}
    >
      <div className="flex flex-col gap-1.5">
        {raffleRecord.winners.map((winner, index) => (
          <div key={index} className="flex justify-between">
            <p className="line-clamp-1">{winner.displayName}</p>
            {winner.claimed ? (
              <Badge className="bg-green-500 text-white">Claimed</Badge>
            ) : null}
          </div>
        ))}
        <div className="mt-2 flex justify-between">
          {raffleRecord.wasDisplayed ? (
            <Badge className="bg-yellow-400 text-black">Displayed</Badge>
          ) : (
            <span />
          )}
          <p>{dayjs(raffleRecord.createdAt).fromNow(true)}</p>
        </div>
      </div>
    </div>
  );
};

export default RaffleHistoryCard;
