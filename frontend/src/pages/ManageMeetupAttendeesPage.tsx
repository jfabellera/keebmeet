import dayjs from 'dayjs';
import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { type TicketInfo } from '../../../backend/src/controllers/meetups';
import { useGetMeetupAttendeesQuery } from '../store/organizerSlice';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    <div className="m-2 rounded-md bg-card p-2 text-card-foreground shadow-sm md:m-4">
      <h2 className="px-6 py-4 text-2xl font-semibold">Attendees</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Display Name</TableHead>
            <TableHead className="hidden md:table-cell">First Name</TableHead>
            <TableHead className="hidden md:table-cell">Last Name</TableHead>
            <TableHead>Signed Up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAttendees != null
            ? sortedAttendees.map((attendee: TicketInfo) => (
                <TableRow key={attendee.id}>
                  <TableCell>{attendee.ticket_holder_display_name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {attendee.ticket_holder_first_name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {attendee.ticket_holder_last_name}
                  </TableCell>
                  <TableCell>
                    {dayjs(attendee.created_at).format('M/D/YY hh:mm A')}
                  </TableCell>
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>
    </div>
  );
};

export default ManageMeetupAttendeesPage;
