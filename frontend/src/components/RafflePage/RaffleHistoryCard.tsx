import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type RaffleRecordResponse } from '@keebmeet/shared';
import dayjs from 'dayjs';
import RelativeTime from 'dayjs/plugin/relativeTime';
import { type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import { toast } from 'sonner';
import { useDeleteRaffleRecordMutation } from '../../store/organizerSlice';
import { Button } from '../ui/button';

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
  const [deleteRaffleRecord, { isLoading: isDeleting }] =
    useDeleteRaffleRecordMutation();

  const handleClick = (): void => {
    onCardClick(Number(raffleRecord.id)); // TODO(jan): id is actually a string
  };

  const handleDelete = async (): Promise<void> => {
    try {
      await deleteRaffleRecord(Number(raffleRecord.id)).unwrap();
    } catch {
      toast.error('Error', {
        description: 'Failed to delete raffle roll',
        position: 'top-center',
      });
    }
  };

  return (
    <div
      className={cn(
        'bg-card text-card-foreground flex w-full cursor-pointer flex-col gap-2 rounded-md p-4 shadow-sm',
        className
      )}
      onClick={handleClick}
      {...rest}
    >
      <div className="flex justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {raffleRecord.wasDisplayed ? (
            <Badge className="bg-yellow-400 text-black">Displayed</Badge>
          ) : (
            <Badge className="bg-gray-300 text-black">Not Displayed</Badge>
          )}
          <p className="italic">
            {dayjs(raffleRecord.createdAt).fromNow(true)} ago
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            void handleDelete();
          }}
        >
          <FiX />
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {raffleRecord.winners.map((winner, index) => (
          <div key={index} className="flex justify-between">
            <p className="line-clamp-1">{winner.displayName}</p>
            {winner.claimed ? (
              <Badge className="bg-green-500 text-white">Claimed</Badge>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RaffleHistoryCard;
