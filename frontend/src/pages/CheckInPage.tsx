import type React from 'react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FiCheck } from 'react-icons/fi';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';
import { type TicketInfo } from '../../../backend/src/controllers/meetups';
import {
  useCheckInAttendeeMutation,
  useGetMeetupAttendeesQuery,
} from '../store/organizerSlice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/lib/utils';

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

  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [checkInAttendee] = useCheckInAttendeeMutation();

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
          toast.error('Error', {
            description: `Could not check ${ticket.ticket_holder_display_name} in`,
          });
        } else {
          toast.success('Success', {
            description: `${ticket.ticket_holder_display_name} checked in`,
          });
        }
      }
      setTicket(null);
      setSearchValue('');
      onClose();
    })();
  };

  return (
    <div className="flex h-full flex-col gap-2 p-4 text-center">
      <h2 className="mb-2 text-center text-2xl font-medium">Check-in</h2>
      <div className="rounded-md bg-card p-2 text-card-foreground shadow-sm">
        <Input
          ref={searchRef}
          className="border-0 shadow-none focus-visible:ring-0"
          placeholder={'Start typing a username, name, or email...'}
          value={searchValue}
          onChange={handleSearchChange}
        />
      </div>
      <div className="rounded-md bg-card p-4 text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Checked in?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAttendees != null
              ? filteredAttendees.map((attendee) => (
                  <TableRow
                    key={attendee.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-blue-400 hover:text-white',
                      focusedIndex != null &&
                        attendee.id === filteredAttendees[focusedIndex].id
                        ? 'bg-blue-400 text-white'
                        : ''
                    )}
                    onClick={() => {
                      setTicket(attendee);
                      onOpen();
                    }}
                  >
                    <TableCell>{attendee.ticket_holder_display_name}</TableCell>
                    <TableCell>{attendee.ticket_holder_first_name}</TableCell>
                    <TableCell>{attendee.ticket_holder_last_name}</TableCell>
                    <TableCell>
                      {attendee.is_checked_in ? <FiCheck /> : null}
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>

        <Dialog
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              setTicket(null);
              onClose();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm check-in</DialogTitle>
            </DialogHeader>
            <p>
              Do you want to check{' '}
              {ticket?.ticket_holder_display_name ?? 'user'} in?
            </p>
            <DialogFooter>
              <Button
                autoFocus
                className="bg-blue-500 text-white hover:bg-blue-600"
                onClick={handleConfirm}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CheckInPage;
