import { type ReactNode } from 'react';
import {
  AspectRatio,
  Badge,
  Card,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Spacer,
  Text,
  VStack,
} from '@chakra-ui/react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { FiImage } from 'react-icons/fi';
import type { MeetupInfo } from '../../../../backend/src/controllers/meetups';

dayjs.extend(customParseFormat);

export interface MeetupCardProps {
  meetup: MeetupInfo;
  attending?: boolean;
}

export const MeetupCard = ({
  meetup,
  attending,
}: MeetupCardProps): ReactNode => {
  return (
    <Card
      background={'white'}
      borderRadius="md"
      overflow="hidden"
      height="100%"
      cursor={'pointer'}
    >
      <AspectRatio ratio={2 / 1}>
        <Image
          src={meetup.image_url}
          fallback={
            <Flex backgroundColor={'gray.200'}>
              <Icon as={FiImage} boxSize={8} />
            </Flex>
          }
          objectFit="cover"
        />
      </AspectRatio>
      <CardHeader padding={'12px'}>
        <VStack spacing={2} align={'left'}>
          <HStack>
            <Text fontWeight={'semibold'} color={'gray.600'}>
              {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format(
                'MMMM DD, YYYY'
              )}
            </Text>
            <Spacer />
            {attending != null && attending ? (
              <Badge colorScheme={'green'}>RSVPed</Badge>
            ) : null}
          </HStack>
          <Heading size={'md'}>{meetup.name}</Heading>
          <Text>{`${meetup.location.city}, ${
            meetup.location.state ?? meetup.location.country
          }`}</Text>
        </VStack>
      </CardHeader>
    </Card>
  );
};
