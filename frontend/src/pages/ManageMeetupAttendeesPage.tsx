import {
  Box,
  Heading,
  Show,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import dayjs from 'dayjs';
import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { type TicketInfo } from '../../../backend/src/controllers/meetups';
import { useGetMeetupAttendeesQuery } from '../store/organizerSlice';

const ManageMeetupAttendeesPage = (): ReactNode => {
  const { meetupId } = useParams();
  const { data: attendees } = useGetMeetupAttendeesQuery({
    meetup_id: parseInt(meetupId ?? '0'),
    params: {
      detail_level: 'detailed',
    },
  });

  const sortedAttendees = useMemo(
    () =>
      attendees
        ?.slice()
        .sort((a, b) => (dayjs(a.created_at).isBefore(b.created_at) ? 1 : -1)),
    [attendees]
  );

  return (
    <Box
      background={'white'}
      padding={'0.5rem'}
      borderRadius={'md'}
      boxShadow={'sm'}
      margin={{ base: '0.5rem', md: '1rem' }}
    >
      <Heading size={'lg'} paddingX={'1.5rem'} paddingY={'1rem'}>
        Attendees
      </Heading>
      <TableContainer>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Display Name</Th>
              <Show above={'md'}>
                <Th>First Name</Th>
                <Th>Last Name</Th>
              </Show>
              <Th>Signed Up</Th>
            </Tr>
          </Thead>
          <Tbody>
            {sortedAttendees != null
              ? sortedAttendees.map((attendee: TicketInfo) => (
                  <Tr key={attendee.id}>
                    <Td>{attendee.ticket_holder_display_name}</Td>
                    <Show above={'md'}>
                      <Td>{attendee.ticket_holder_first_name}</Td>
                      <Td>{attendee.ticket_holder_last_name}</Td>
                    </Show>
                    <Td>
                      {dayjs(attendee.created_at).format('M/D/YY hh:mm A')}
                    </Td>
                  </Tr>
                ))
              : null}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ManageMeetupAttendeesPage;
