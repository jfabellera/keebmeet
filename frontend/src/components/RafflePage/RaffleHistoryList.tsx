import { type ReactNode } from 'react';
import { useGetRaffleHistoryQuery } from '../../store/organizerSlice';
import RaffleHistoryCard from './RaffleHistoryCard';
import { cn } from '@/lib/utils';

interface Props extends React.ComponentProps<'div'> {
  meetupId: string;
  onCardClick: (raffleRecordId: string) => void;
}

const RaffleHistoryList = ({
  meetupId,
  onCardClick,
  className,
  ...rest
}: Props): ReactNode => {
  const { data: raffleRecords } = useGetRaffleHistoryQuery(meetupId);

  return (
    <div className={cn('flex', className)} {...rest}>
      {raffleRecords != null && raffleRecords.length > 0 ? (
        <div className="flex w-full flex-col gap-2">
          {raffleRecords.map((record, index) => (
            <RaffleHistoryCard
              key={index}
              raffleRecord={record}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      ) : (
        <p>No previous rolls</p>
      )}
    </div>
  );
};

export default RaffleHistoryList;
