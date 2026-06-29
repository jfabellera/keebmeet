import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  useDeleteMeetupMutation,
  useGetMeetupQuery,
} from '@/store/meetupSlice';
import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface Props {
  meetupId: number;
}

export const DeleteMeetupCard = ({ meetupId }: Props): ReactNode => {
  const navigate = useNavigate();
  const { data: meetup } = useGetMeetupQuery(meetupId);
  const [deleteMeetup, { isLoading: isDeleting }] = useDeleteMeetupMutation();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Deleting a meetup wipes all of its tickets, raffle records and wins, so we
  // require the organizer to type the meetup's name to confirm.
  const canConfirm =
    meetup != null && confirmText.trim() === meetup.name.trim();

  const onDelete = async (): Promise<void> => {
    if (!canConfirm) return;

    const result = await deleteMeetup(meetupId);

    if ('error' in result && result.error != null) {
      const error = result.error as { data?: { message?: string } };
      toast.error('Failed to delete meetup', {
        description: error.data?.message,
      });
      return;
    }

    setOpen(false);
    setConfirmText('');
    toast.success('Meetup deleted.');
    navigate('/organizer');
  };

  return (
    <Card className="border-destructive gap-2 p-4">
      <h2 className="text-destructive text-2xl font-semibold">Danger zone</h2>
      <p className="text-muted-foreground">
        Deleting this meetup permanently removes it along with all of its
        tickets, raffle records, and raffle wins. This action cannot be undone.
      </p>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText('');
        }}
      >
        <DialogTrigger asChild>
          <Button className="self-start" variant="destructive">
            Delete meetup
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this meetup?</DialogTitle>
            <DialogDescription>
              This permanently deletes the meetup and all of its tickets, raffle
              records, and raffle wins. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="confirm-meetup-name">
              Type{' '}
              <span className="font-bold">{meetup?.name}</span> to confirm.
            </FieldLabel>
            <Input
              id="confirm-meetup-name"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={meetup?.name}
              autoComplete="off"
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                void onDelete();
              }}
              disabled={!canConfirm || isDeleting}
            >
              Delete meetup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DeleteMeetupCard;
