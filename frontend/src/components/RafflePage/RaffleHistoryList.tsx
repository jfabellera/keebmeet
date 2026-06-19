import { type ReactNode } from 'react';
import { Flex, Text, VStack, type FlexProps } from '@chakra-ui/react';
import { useGetRaffleHistoryQuery } from '../../store/organizerSlice';
import RaffleHistoryCard from './RaffleHistoryCard';

interface Props extends FlexProps {
  meetupId: number;
  onCardClick: (raffleRecordId: number) => void;
}

const RaffleHistoryList = ({
  meetupId,
  onCardClick,
  ...rest
}: Props): ReactNode => {
  const { data: raffleRecords } = useGetRaffleHistoryQuery(meetupId);

  return (
    <Flex {...rest}>
      {raffleRecords != null && raffleRecords.length > 0 ? (
        <VStack width={'100%'}>
          {raffleRecords.map((record, index) => (
            <RaffleHistoryCard
              key={index}
              raffleRecord={record}
              onCardClick={onCardClick}
            />
          ))}
        </VStack>
      ) : (
        <Text>No previous rolls</Text>
      )}
    </Flex>
  );
};

export default RaffleHistoryList;
