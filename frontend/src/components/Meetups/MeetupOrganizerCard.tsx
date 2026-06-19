import { type ReactNode } from 'react';
import {
  AspectRatio,
  Card,
  CardBody,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Stack,
  Text,
} from '@chakra-ui/react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { FiCalendar, FiClock, FiImage, FiUsers } from 'react-icons/fi';

dayjs.extend(customParseFormat);

export interface MeetupOrganizerCardProps {
  name: string;
  date: string;
  imageUrl: string;
  ticketsAvailable: number;
  ticketsTotal: number;
  onClick: () => void;
}

export const MeetupOrganizerCard = ({
  name,
  date,
  imageUrl,
  ticketsAvailable,
  ticketsTotal,
  onClick,
}: MeetupOrganizerCardProps): ReactNode => {
  return (
    <Card
      background={'white'}
      direction={'row'}
      cursor={'pointer'}
      onClick={onClick}
    >
      <AspectRatio
        ratio={{ base: 1 / 1, sm: 2 / 1 }}
        width={{ base: '33%', sm: '40%' }}
      >
        <Image
          src={imageUrl}
          borderLeftRadius={'md'}
          fallback={
            <Flex backgroundColor={'gray.200'}>
              <Icon as={FiImage} boxSize={8} />
            </Flex>
          }
        />
      </AspectRatio>
      <CardBody
        width={{ base: '67%', sm: '60%' }}
        padding={'1rem'}
        paddingY={{ base: '0.5rem', sm: '1rem' }}
        textOverflow={'ellipsis'}
        overflow={'hidden'}
        display={'flex'}
        flexDirection={'column'}
      >
        <Stack spacing={{ base: 0, sm: 1.5 }} flex={1} justify={'center'}>
          <Heading size={'md'} fontWeight={'semibold'} noOfLines={1}>
            {name}
          </Heading>
          <HStack>
            <Icon as={FiCalendar} />
            <Text noOfLines={1}>
              {dayjs(date, 'YYYY-MM-DDTHH:mm:ss').format('MMMM DD, YYYY')}
            </Text>
          </HStack>
          <HStack>
            <Icon as={FiClock} />
            <Text noOfLines={1}>
              {`${dayjs(date, 'YYYY-MM-DDTHH:mm:ss').diff(
                dayjs(),
                'day'
              )} days`}
            </Text>
          </HStack>
          <HStack>
            <Icon as={FiUsers} />
            <Text noOfLines={1}>{`${
              ticketsTotal - ticketsAvailable
            } / ${ticketsTotal}`}</Text>
          </HStack>
        </Stack>
      </CardBody>
      {/* <CardBody padding={0} margin={0}>
        </CardBody> */}
    </Card>
  );
};
