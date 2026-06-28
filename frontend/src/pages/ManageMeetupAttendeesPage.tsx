import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { type TicketInfo } from '../../../backend/src/controllers/meetups';
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

  const [editing, setEditing] = useState<TicketInfo | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [raffleEntries, setRaffleEntries] = useState<string>('');

  const sortedAttendees = useMemo(
    () =>
      attendees
        ?.slice()
        .sort((a, b) => (dayjs(a.created_at).isBefore(b.created_at) ? 1 : -1)),
    [attendees]
  );

  const openEditDialog = (attendee: TicketInfo): void => {
    setEditing(attendee);
    setDisplayName(attendee.ticket_holder_display_name);
    setRaffleEntries(String(attendee.raffle_entries));
    onOpen();
  };

  const closeEditDialog = (): void => {
    setEditing(null);
    onClose();
  };

  const entries = parseInt(raffleEntries, 10);
  const canSave =
    editing != null &&
    displayName.trim() !== '' &&
    Number.isInteger(entries) &&
    entries >= 0;

  const handleSave = (): void => {
    if (editing == null || !canSave) return;

    void (async () => {
      const result = await editAttendee({
        ticketId: editing.id,
        payload: {
          raffle_entries: entries,
        },
      });

      if ('error' in result) {
        toast.error('Error', {
          description: `Could not update ${editing.ticket_holder_display_name}`,
        });
      } else {
        toast.success('Success', {
          description: `${displayName.trim()} updated`,
        });
        closeEditDialog();
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
            <TableHead className="w-0 text-center">Edit</TableHead>
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
                  <TableCell className="hidden text-center md:table-cell">
                    {attendee.raffle_entries}
                  </TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    {attendee.raffle_wins}
                  </TableCell>
                  <TableCell>
                    {dayjs(attendee.created_at).format('M/D/YY hh:mm A')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit attendee"
                      onClick={() => {
                        openEditDialog(attendee);
                      }}
                    >
                      <FiEdit2 />
                    </Button>
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
            closeEditDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit attendee</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="raffle-entries">Raffle Entries</Label>
              <Input
                id="raffle-entries"
                type="number"
                min={0}
                value={raffleEntries}
                onChange={(e) => {
                  setRaffleEntries(e.target.value);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button disabled={!canSave} onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageMeetupAttendeesPage;
