import {
  AspectRatio,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalOverlay,
  Spacer,
  Text,
} from '@chakra-ui/react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useEffect, type ReactNode } from 'react';
import {
  FiCalendar,
  FiClock,
  FiExternalLink,
  FiMapPin,
  FiUser,
  FiUserCheck,
  FiUserX,
} from 'react-icons/fi';
import { type SimpleTicketInfo } from '../../../../backend/src/controllers/tickets';
import { socket } from '../../socket';
import { useAppDispatch } from '../../store/hooks';
import { meetupSlice, useGetMeetupQuery } from '../../store/meetupSlice';
import {
  useCreateTicketMutation,
  useDeleteTicketMutation,
} from '../../store/ticketSlice';
import { MeetupCapacityStatus } from './MeetupCapacityStatus';

dayjs.extend(customParseFormat);

export interface MeetupModalProps {
  meetupId: number;
  isLoggedIn: boolean;
  ticket: SimpleTicketInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export const MeetupModal = ({
  meetupId,
  isLoggedIn,
  ticket,
  isOpen,
  onClose,
  onOpen,
}: MeetupModalProps): ReactNode => {
  const { data: meetup, refetch: refetchMeetup } = useGetMeetupQuery(meetupId, {
    skip: meetupId < 1,
  });
  const [rsvp] = useCreateTicketMutation();
  const [unrsvp] = useDeleteTicketMutation();
  const dispatch = useAppDispatch();

  /**
   * Subscribe user to updates for the selected meetup. This will invalidate the
   * cache for the fetched meetup. This is mostly used to update the ticket
   * availability in real time.
   */
  useEffect(() => {
    if (meetup == null) return;

    const onMeetupUpdate = (meetupId: number): void => {
      dispatch(
        meetupSlice.util.invalidateTags([{ type: 'Meetup', id: meetupId }])
      );
    };

    socket.emit('meetup:subscribe', { meetupId: Number(meetupId) });

    socket.on('meetup:update', (payload) => {
      onMeetupUpdate(payload.meetupId);
    });

    // Resubscribe and force update on reconnection after losing connection
    socket.on('connect', () => {
      socket.emit('meetup:subscribe', { meetupId: Number(meetupId) });
      onMeetupUpdate(Number(meetupId));
    });

    // Stay subscribed to updates in case user comes back to page
  }, [meetup]);

  // Open modal once meetup is loaded
  useEffect(() => {
    if (meetupId !== 0) {
      onOpen();
    }
  }, [meetup]);

  /**
   * RSVP for meetup and refetch meetup info to update count
   */
  const rsvpOnclick = (): void => {
    // void to match onClick expected type
    void (async () => {
      if (meetup != null) {
        await rsvp(meetup.id);
        await refetchMeetup();
      }
    })();
  };

  /**
   * Remove RSVP for meetup and refetch meetup info to update count
   */
  const unrsvpOnClick = (): void => {
    // void to match onClick expected type
    void (async () => {
      if (ticket != null) {
        await unrsvp(ticket.id);
        await refetchMeetup();
      }
    })();
  };

  if (meetup == null) return <></>;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      motionPreset={'slideInBottom'}
      size={{ base: 'full', md: '3xl' }}
      scrollBehavior={'inside'}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalBody padding={0}>
          {meetup.image_url != null && meetup.image_url !== '' ? (
            <AspectRatio ratio={2 / 1}>
              <Image
                src={meetup.image_url}
                objectFit="cover"
                borderTopRadius={'md'}
              />
            </AspectRatio>
          ) : null}
          <Flex direction={'column'} padding={'1em'} paddingBottom={'0'}>
            <Heading paddingBottom={'0.4em'}>{meetup.name}</Heading>
            <Flex
              direction={'column'}
              paddingBottom={'1em'}
              fontWeight={'semibold'}
            >
              {/* Date */}
              <HStack>
                <Icon as={FiCalendar} />
                <Text>
                  {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format(
                    'MMMM DD, YYYY'
                  )}
                </Text>
              </HStack>

              {/* Time */}
              {/* TODO(jan): Add end time once implemented into API */}
              <HStack>
                <Icon as={FiClock} />
                <Text>
                  {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format('h:mm A')}
                  {' - '}
                  {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss')
                    .add(meetup.duration_hours ?? 0, 'hours')
                    .format('h:mm A')}
                </Text>
              </HStack>

              {/* Location */}
              <HStack>
                <Icon as={FiMapPin} />
                <Text>{meetup.location.full_address}</Text>
              </HStack>

              {/* Organizers */}
              {meetup.organizers != null ? (
                <HStack>
                  <Icon as={FiUser} />
                  <Text>
                    Organized by{' '}
                    {new Intl.ListFormat().format(meetup.organizers)}
                  </Text>
                </HStack>
              ) : null}
            </Flex>

            {/* Description */}
            {meetup.description !== '' ? (
              <>
                <Text fontWeight={'semibold'}>Description</Text>
                <Text whiteSpace={'pre-line'}>{meetup.description}</Text>
              </>
            ) : (
              <Text>
                <i>No description</i>
              </Text>
            )}
          </Flex>
        </ModalBody>

        <ModalFooter>
          {meetup.tickets != null ? (
            <MeetupCapacityStatus
              available={meetup.tickets.available}
              total={meetup.tickets.total}
            />
          ) : null}
          <Spacer />
          {meetup.eventbrite_url != null ? (
            <Link href={meetup.eventbrite_url} isExternal mr={3}>
              <Button leftIcon={<FiExternalLink />}>RSVP</Button>
            </Link>
          ) : ticket != null ? (
            <Button
              leftIcon={<FiUserX />}
              colorScheme={'red'}
              mr={3}
              isDisabled={!isLoggedIn}
              onClick={unrsvpOnClick}
            >
              Cancel RSVP
            </Button>
          ) : (
            <Button
              leftIcon={<FiUserCheck />}
              colorScheme={'green'}
              mr={3}
              isDisabled={!isLoggedIn}
              onClick={rsvpOnclick}
            >
              RSVP
            </Button>
          )}
          <Button colorScheme={'pink'} mr={3} onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
