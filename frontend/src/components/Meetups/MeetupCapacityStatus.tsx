import { type ReactNode } from 'react';
import { HStack, Icon, Text } from '@chakra-ui/react';
import { FaCircle } from 'react-icons/fa';

export interface MeetupCapacityStatusProps {
  available: number;
  total: number;
}

export const MeetupCapacityStatus = ({
  available,
  total,
}: MeetupCapacityStatusProps): ReactNode => {
  let statusColor: string;
  const capacityRatio = available / total;

  if (capacityRatio > 0.4) {
    statusColor = 'green.500';
  } else if (capacityRatio > 0.1) {
    statusColor = 'yellow.500';
  } else {
    statusColor = 'red.500';
  }

  return (
    <HStack>
      <Icon as={FaCircle} boxSize={3} color={statusColor} />
      <Text>
        {available} of {total} available
      </Text>
    </HStack>
  );
};
