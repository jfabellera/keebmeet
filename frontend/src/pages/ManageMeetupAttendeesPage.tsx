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
import dayjs from 'dayjs';
import { useMemo, useState, type ReactNode } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type TicketInfo } from '@keebmeet/shared';
import {
  useEditAttendeeMutation,
  useGetMeetupAttendeesQuery,
} from '../store/organizerSlice';

const ManageMeetupAttendeesPage = (): ReactNode => {
  const { meetupId } = useParams();
  const { data: attendees } = useGetMeetupAttendeesQuery({
    meetup_id: parseInt(meetupId ?? '0'),
    params: {
      detail_level: 'detailed',
    },
  });

  const [editAttendee] = useEditAttendeeMutation();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [viewing, setViewing] = useState<TicketInfo | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [raffleEntries, setRaffleEntries] = useState<string>('');

  const sortedAttendees = useMemo(
    () =>
      attendees
        ?.slice()
        .sort((a, b) => (dayjs(a.created_at).isBefore(b.created_at) ? 1 : -1)),
    [attendees]
  );

  const openDialog = (attendee: TicketInfo): void => {
    setViewing(attendee);
    setRaffleEntries(String(attendee.raffle_entries));
    setIsEditing(false);
    onOpen();
  };

  const closeDialog = (): void => {
    setViewing(null);
    setIsEditing(false);
    onClose();
  };

  const startEditing = (): void => {
    if (viewing == null) return;
    setRaffleEntries(String(viewing.raffle_entries));
    setIsEditing(true);
  };

  const cancelEditing = (): void => {
    if (viewing != null) {
      setRaffleEntries(String(viewing.raffle_entries));
    }
    setIsEditing(false);
  };

  const entries = parseInt(raffleEntries, 10);
  const canSave = Number.isInteger(entries) && entries >= 0;

  const handleSave = (): void => {
    if (viewing == null || !canSave) return;

    void (async () => {
      const result = await editAttendee({
        ticketId: viewing.id,
        payload: {
          raffle_entries: entries,
        },
      });

      if ('error' in result) {
        toast.error('Error', {
          description: `Could not update ${viewing.ticket_holder_display_name}`,
        });
      } else {
        toast.success('Success', {
          description: `${viewing.ticket_holder_display_name} updated`,
        });
        // Reflect the saved value immediately and return to view mode.
        setViewing({ ...viewing, raffle_entries: entries });
        setIsEditing(false);
      }
    })();
  };

  return (
    <div className="bg-card text-card-foreground m-2 rounded-md p-2 shadow-sm md:m-4">
      <h2 className="px-6 py-4 text-2xl font-semibold">Attendees</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Display Name</TableHead>
            <TableHead className="hidden md:table-cell">First Name</TableHead>
            <TableHead className="hidden md:table-cell">Last Name</TableHead>
            <TableHead className="hidden text-center md:table-cell">
              Raffle Entries
            </TableHead>
            <TableHead className="hidden text-center md:table-cell">
              Raffle Wins
            </TableHead>
            <TableHead>Signed Up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAttendees != null
            ? sortedAttendees.map((attendee: TicketInfo) => (
                <TableRow
                  key={attendee.id}
                  className="hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
                  onClick={() => {
                    openDialog(attendee);
                  }}
                >
                  <TableCell>{attendee.ticket_holder_display_name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {attendee.ticket_holder_first_name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {attendee.ticket_holder_last_name}
                  </TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    {attendee.raffle_entries}
                  </TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    {attendee.raffle_wins}
                  </TableCell>
                  <TableCell>
                    {dayjs(attendee.created_at).format('M/D/YY hh:mm A')}
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
            closeDialog();
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>Attendee details</DialogTitle>
              {!isEditing ? (
                <Button
                  variant="ghost"
                  aria-label="Edit attendee"
                  onClick={startEditing}
                >
                  <FiEdit2 />
                  Edit
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          {viewing != null ? (
            <dl className="grid grid-cols-2 items-center gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Display Name</dt>
              <dd className="text-right">
                {viewing.ticket_holder_display_name}
              </dd>

              <dt className="text-muted-foreground">First Name</dt>
              <dd className="text-right">{viewing.ticket_holder_first_name}</dd>

              <dt className="text-muted-foreground">Last Name</dt>
              <dd className="text-right">{viewing.ticket_holder_last_name}</dd>

              <dt className="text-muted-foreground">Raffle Entries</dt>
              <dd className="text-right">
                {isEditing ? (
                  <Input
                    type="number"
                    min={0}
                    className="ml-auto w-24 text-right"
                    value={raffleEntries}
                    onChange={(e) => {
                      setRaffleEntries(e.target.value);
                    }}
                  />
                ) : (
                  viewing.raffle_entries
                )}
              </dd>

              <dt className="text-muted-foreground">Raffle Wins</dt>
              <dd className="text-right">{viewing.raffle_wins}</dd>

              <dt className="text-muted-foreground">Signed Up</dt>
              <dd className="text-right">
                {dayjs(viewing.created_at).format('M/D/YY hh:mm A')}
              </dd>
            </dl>
          ) : null}
          <DialogFooter>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button disabled={!canSave} onClick={handleSave}>
                  Save
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={closeDialog}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageMeetupAttendeesPage;
