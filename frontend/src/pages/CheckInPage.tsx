import {
  Box,
  Button,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FiCheck } from 'react-icons/fi';
import { useParams } from 'react-router-dom';
import { type TicketInfo } from '../../../backend/src/controllers/meetups';
import {
  useCheckInAttendeeMutation,
  useGetMeetupAttendeesQuery,
} from '../store/organizerSlice';

const CheckInPage = (): ReactNode => {
  const { meetupId: meetupIdParam } = useParams();
  const meetupId = parseInt(meetupIdParam ?? '');
  const { data: attendees } = useGetMeetupAttendeesQuery({
    meetup_id: meetupId,
    params: { detail_level: 'detailed' },
  });

  const [searchValue, setSearchValue] = useState<string>('');
  const searchRef = useRef<HTMLInputElement>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const confirmRef = useRef<HTMLButtonElement>(null);

  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [checkInAttendee] = useCheckInAttendeeMutation();
  const toast = useToast();

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const filteredAttendees = useMemo(() => {
    if (attendees == null) return [];
    const filtered = attendees
      .filter(
        (attendee: TicketInfo) =>
          Boolean(
            attendee.ticket_holder_display_name
              .toLowerCase()
              .includes(searchValue.toLowerCase())
          ) ||
          Boolean(
            attendee.ticket_holder_first_name
              .toLowerCase()
              .includes(searchValue.toLowerCase())
          ) ||
          Boolean(
            attendee.ticket_holder_last_name
              .toLowerCase()
              .includes(searchValue.toLowerCase())
          )
      )
      .sort((a, b) => {
        return a.ticket_holder_display_name.toLowerCase() <
          b.ticket_holder_display_name.toLowerCase()
          ? -1
          : 1;
      });

    if (searchValue !== '' && filtered.length > 0) {
      setFocusedIndex(0);
    } else {
      setFocusedIndex(null);
    }

    return filtered;
  }, [attendees, searchValue]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      searchRef.current?.focus();

      if (event.key === 'Escape') {
        setSearchValue('');
      }

      if (event.key === 'Enter') {
        if (!isOpen && searchValue !== '' && focusedIndex != null) {
          event.preventDefault();
          setTicket(filteredAttendees[focusedIndex]);
          onOpen();
        }
      }

      if (event.key === 'ArrowDown') {
        if (focusedIndex != null) {
          event.preventDefault();
          setFocusedIndex(
            Math.min(filteredAttendees.length - 1, focusedIndex + 1)
          );
        }
      }

      if (event.key === 'ArrowUp') {
        if (focusedIndex != null) {
          event.preventDefault();
          setFocusedIndex(Math.max(0, focusedIndex - 1));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedIndex, isOpen, searchValue, filteredAttendees]);

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setFocusedIndex(null);
    setSearchValue(event.target.value);
  };

  const handleConfirm = (): void => {
    void (async () => {
      if (ticket != null) {
        const result = await checkInAttendee(ticket.id);

        if ('error' in result) {
          toast({
            title: 'Error',
            description: `Could not check ${ticket.ticket_holder_display_name} in`,
            status: 'error',
            isClosable: true,
          });
        } else {
          toast({
            title: 'Success',
            description: `${ticket.ticket_holder_display_name} checked in`,
            status: 'success',
            isClosable: true,
          });
        }
      }
      setTicket(null);
      setSearchValue('');
      onClose();
    })();
  };

  return (
    <Stack
      height={'100%'}
      direction={'column'}
      textAlign={'center'}
      padding={'1rem'}
    >
      <Heading
        size={'lg'}
        fontWeight={'medium'}
        marginBottom={'0.5rem'}
        textAlign={'center'}
      >
        Check-in
      </Heading>
      <Box
        padding={'0.5rem'}
        background={'white'}
        borderRadius={'md'}
        boxShadow={'sm'}
      >
        <Input
          ref={searchRef}
          variant={'ghost'}
          placeholder={'Start typing a username, name, or email...'}
          value={searchValue}
          onChange={handleSearchChange}
        />
      </Box>
      <Box
        background={'white'}
        borderRadius={'md'}
        boxShadow={'sm'}
        padding={'1rem'}
      >
        <TableContainer>
          <Table variant={'simple'}>
            <Thead>
              <Tr>
                <Th>Display Name</Th>
                <Th>First Name</Th>
                <Th>Last Name</Th>
                <Th>Checked in?</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredAttendees != null
                ? filteredAttendees.map((attendee) => (
                    <Tr
                      key={attendee.id}
                      cursor={'pointer'}
                      background={
                        focusedIndex != null &&
                        attendee.id === filteredAttendees[focusedIndex].id
                          ? 'blue.400'
                          : 'white'
                      }
                      color={
                        focusedIndex != null &&
                        attendee.id === filteredAttendees[focusedIndex].id
                          ? 'white'
                          : 'black'
                      }
                      _hover={{ bg: 'blue.400', color: 'white' }}
                      transition={'background 100ms linear, color 100ms linear'}
                      onClick={() => {
                        setTicket(attendee);
                        onOpen();
                      }}
                    >
                      <Td>{attendee.ticket_holder_display_name}</Td>
                      <Td>{attendee.ticket_holder_first_name}</Td>
                      <Td>{attendee.ticket_holder_last_name}</Td>
                      <Td>{attendee.is_checked_in ? <FiCheck /> : null}</Td>
                    </Tr>
                  ))
                : null}
            </Tbody>
          </Table>
        </TableContainer>

        <Modal
          initialFocusRef={confirmRef}
          isOpen={isOpen}
          onClose={() => {
            setTicket(null);
            onClose();
          }}
        >
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Confirm check-in</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              Do you want to check{' '}
              {ticket?.ticket_holder_display_name ?? 'user'} in?
            </ModalBody>

            <ModalFooter>
              <Button
                ref={confirmRef}
                colorScheme="blue"
                onClick={handleConfirm}
              >
                Confirm
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </Stack>
  );
};

export default CheckInPage;
