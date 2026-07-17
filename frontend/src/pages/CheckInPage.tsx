import QrScanner from '@/components/shared/QrScanner';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/lib/utils';
import { type TicketInfo } from '@keebmeet/shared';
import type React from 'react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FiCheck } from 'react-icons/fi';
import { MdQrCodeScanner } from 'react-icons/md';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useGetMeetupQuery } from '../store/meetupSlice';
import {
  useCheckInAttendeeMutation,
  useEditAttendeeMutation,
  useGetMeetupAttendeesQuery,
} from '../store/organizerSlice';

const CheckInPage = (): ReactNode => {
  const { meetupId: slugParam } = useParams();
  const { data: meetup } = useGetMeetupQuery(slugParam ?? '');
  const { data: attendees, isLoading } = useGetMeetupAttendeesQuery(
    {
      meetup_id: meetup?.id ?? '',
      params: { detail_level: 'detailed' },
    },
    { skip: meetup == null }
  );

  const [searchValue, setSearchValue] = useState<string>('');
  const searchRef = useRef<HTMLInputElement>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();

  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  // Tracks the user's intent rather than the ticket's current state: selecting
  // an attendee always means "check in", and undoing only happens via the
  // dedicated button in the table.
  const [action, setAction] = useState<'checkin' | 'uncheckin'>('checkin');
  // Undoing a check-in is destructive, so we require the organizer to type the
  // attendee's display name to confirm.
  const [confirmText, setConfirmText] = useState<string>('');
  const [checkInAttendee, { isLoading: isCheckingIn }] =
    useCheckInAttendeeMutation();
  const [editAttendee, { isLoading: isUncheckingIn }] =
    useEditAttendeeMutation();

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const [useCamera, setUseCamera] = useState<boolean>(false);

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
          ) ||
          Boolean(attendee.qr_code_value.includes(searchValue))
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

  const handleCheckIn = (attendee: TicketInfo | null = ticket): void => {
    void (async () => {
      if (attendee != null) {
        const result = await checkInAttendee(attendee.id);

        if ('error' in result) {
          toast.error('Error', {
            description: `Could not check ${attendee.ticket_holder_display_name} in`,
          });
        } else {
          toast.success('Success', {
            description: `${attendee.ticket_holder_display_name} checked in`,
          });
        }
      }
      setTicket(null);
      setSearchValue('');
      setConfirmText('');
      onClose();
    })();
  };

  // Whether the undo confirmation requirement (typing the display name) is met.
  // Check-in has no such requirement.
  const canConfirm =
    action === 'checkin' ||
    (ticket != null &&
      confirmText.trim() === ticket.ticket_holder_display_name.trim());

  const handleUncheckIn = (): void => {
    if (!canConfirm) return;
    void (async () => {
      if (ticket != null) {
        const result = await editAttendee({
          ticketId: ticket.id,
          payload: { is_checked_in: false },
        });

        if ('error' in result) {
          toast.error('Error', {
            description: `Could not undo check-in for ${ticket.ticket_holder_display_name}`,
          });
        } else {
          toast.success('Success', {
            description: `Check-in undone for ${ticket.ticket_holder_display_name}`,
          });
        }
      }
      setTicket(null);
      setSearchValue('');
      setConfirmText('');
      onClose();
    })();
  };

  const handleSelectAttendee = (
    attendee: TicketInfo,
    bypassConfirm: boolean = false
  ): void => {
    if (attendee.is_checked_in) {
      toast.warning('Already checked in', {
        description: `${attendee.ticket_holder_display_name} is already checked in`,
      });
      if (bypassConfirm) {
        setSearchValue('');
      } else {
        searchRef.current?.select();
      }
      return;
    }

    setTicket(attendee);
    setAction('checkin');

    if (bypassConfirm) {
      handleCheckIn(attendee);
      return;
    }

    onOpen();
  };

  // If whole search value matches a QR code, automatically check in the
  // attendee without requiring a confirmation dialog. Useful for barcode
  // scanners. Scanners don't need to be configured to press enter after
  // scanning, but if they do there shouldn't be any issues.
  useEffect(() => {
    if (
      filteredAttendees.length === 1 &&
      searchValue === filteredAttendees[0].qr_code_value
    ) {
      handleSelectAttendee(filteredAttendees[0], true);
    }
  }, [searchValue, filteredAttendees]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isOpen) {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (action === 'uncheckin') {
            handleUncheckIn();
          } else {
            handleCheckIn();
          }
        }
        return;
      }

      searchRef.current?.focus();

      if (event.key === 'Escape') {
        setSearchValue('');
      }

      if (event.key === 'Enter') {
        if (searchValue !== '' && focusedIndex != null) {
          event.preventDefault();
          handleSelectAttendee(filteredAttendees[focusedIndex]);
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
  }, [
    focusedIndex,
    isOpen,
    searchValue,
    filteredAttendees,
    action,
    ticket,
    confirmText,
  ]);

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setFocusedIndex(null);
    setSearchValue(event.target.value);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-4 text-center">
      <h2 className="mb-2 text-center text-2xl font-medium">Check-in</h2>

      {useCamera && (
        <div className="flex flex-col items-center justify-center gap-2">
          <QrScanner onScan={setSearchValue} />
        </div>
      )}
      <div className="bg-card text-card-foreground flex flex-row items-center gap-2 rounded-md p-2 shadow-sm">
        <Input
          ref={searchRef}
          className="border-0 shadow-none focus-visible:ring-0"
          placeholder={'Start typing a username, name, or email...'}
          value={searchValue}
          onChange={handleSearchChange}
        />
        <Button
          size="icon-lg"
          variant="outline"
          onClick={() => setUseCamera(!useCamera)}
        >
          <MdQrCodeScanner />
        </Button>
      </div>
      <div className="bg-card text-card-foreground rounded-md p-4 shadow-sm">
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
                      'hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                      focusedIndex != null &&
                        attendee.id === filteredAttendees[focusedIndex].id
                        ? 'bg-accent text-accent-foreground'
                        : ''
                    )}
                    onClick={() => {
                      handleSelectAttendee(attendee);
                    }}
                  >
                    <TableCell className="text-left">
                      {attendee.ticket_holder_display_name}
                    </TableCell>
                    <TableCell className="text-left">
                      {attendee.ticket_holder_first_name}
                    </TableCell>
                    <TableCell className="text-left">
                      {attendee.ticket_holder_last_name}
                    </TableCell>
                    <TableCell className="text-left">
                      {attendee.is_checked_in ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTicket(attendee);
                                setAction('uncheckin');
                                setConfirmText('');
                                onOpen();
                              }}
                            >
                              <FiCheck />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Click to edit</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
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
              setConfirmText('');
              onClose();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {action === 'uncheckin'
                  ? 'Confirm undo check-in'
                  : 'Confirm check-in'}
              </DialogTitle>
            </DialogHeader>
            <p>
              {action === 'uncheckin'
                ? `Do you want to undo check-in for ${ticket?.ticket_holder_display_name ?? 'user'}?`
                : `Do you want to check ${ticket?.ticket_holder_display_name ?? 'user'} in?`}
            </p>
            {action === 'uncheckin' ? (
              <div className="flex flex-col gap-2 text-left">
                <p className="text-muted-foreground text-sm">
                  Type{' '}
                  <span className="text-foreground font-medium">
                    {ticket?.ticket_holder_display_name}
                  </span>{' '}
                  to confirm.
                </p>
                <Input
                  autoFocus
                  value={confirmText}
                  onChange={(e) => {
                    setConfirmText(e.target.value);
                  }}
                  placeholder={ticket?.ticket_holder_display_name}
                />
              </div>
            ) : null}
            <DialogFooter>
              <Button
                variant={action === 'uncheckin' ? 'destructive' : 'default'}
                autoFocus={action === 'checkin'}
                disabled={!canConfirm || isCheckingIn || isUncheckingIn}
                onClick={
                  action === 'uncheckin'
                    ? handleUncheckIn
                    : () => {
                        handleCheckIn();
                      }
                }
              >
                Confirm
                {(isCheckingIn || isUncheckingIn) && <Spinner />}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CheckInPage;
