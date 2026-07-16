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
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import {
  useDeleteMeetupMutation,
  useGetMeetupQuery,
  useTransferMeetupMutation,
} from '@/store/meetupSlice';
import { useGetOrganizersQuery } from '@/store/userSlice';
import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import OrganizerSelect from './OrganizerSelect';

interface Props {
  meetupId: string;
}

export const DangerZoneCard = ({ meetupId }: Props): ReactNode => {
  const navigate = useNavigate();
  const { data: meetup } = useGetMeetupQuery(meetupId);
  const { data: organizers } = useGetOrganizersQuery();
  const [deleteMeetup, { isLoading: isDeleting }] = useDeleteMeetupMutation();
  const [transferMeetup, { isLoading: isTransferring }] =
    useTransferMeetupMutation();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferOrganizerId, setTransferOrganizerId] = useState('');
  const [transferConfirmText, setTransferConfirmText] = useState('');

  // Deleting a meetup wipes all of its tickets, raffle records and wins, so we
  // require the organizer to type the meetup's name to confirm.
  const canConfirm =
    meetup != null && confirmText.trim() === meetup.name.trim();

  const selectedOrganizer = (organizers ?? []).find(
    (organizer) => organizer.id === transferOrganizerId
  );

  // Transferring is irreversible, so we require typing 'organizer/meetup' — the
  // new lead's display name and the meetup name — to confirm.
  const transferConfirmTarget =
    selectedOrganizer != null && meetup != null
      ? `${selectedOrganizer.display_name.trim()}-${meetup.name.trim()}`
      : null;
  const canConfirmTransfer =
    transferConfirmTarget != null &&
    transferConfirmText.trim() === transferConfirmTarget;

  const resetTransfer = (): void => {
    setTransferOrganizerId('');
    setTransferConfirmText('');
  };

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

  const onTransfer = async (): Promise<void> => {
    if (!canConfirmTransfer || selectedOrganizer == null) return;

    const result = await transferMeetup({
      meetupId,
      payload: { new_lead_organizer_id: selectedOrganizer.id },
    });

    if ('error' in result && result.error != null) {
      const error = result.error as { data?: { message?: string } };
      toast.error('Failed to transfer meetup', {
        description: error.data?.message,
      });
      return;
    }

    setTransferOpen(false);
    resetTransfer();
    toast.success(`Meetup transferred to ${selectedOrganizer.display_name}.`);
    // The requestor is no longer the lead organizer, so send them back to their
    // organizer dashboard.
    navigate('/organizer');
  };

  return (
    <Card className="border-destructive gap-2 p-4">
      <h2 className="text-destructive text-2xl font-semibold">Danger zone</h2>

      <p className="text-muted-foreground">
        Transferring this meetup hands it off to another organizer, replacing
        you as the lead organizer entirely. This action cannot be undone.
      </p>
      <Dialog
        open={transferOpen}
        onOpenChange={(next) => {
          setTransferOpen(next);
          if (!next) resetTransfer();
        }}
      >
        <DialogTrigger asChild>
          <Button className="self-start" variant="outline">
            Transfer meetup
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer this meetup?</DialogTitle>
            <DialogDescription>
              This replaces you as the lead organizer entirely. The new lead
              gains full control of the meetup and this action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {meetup?.is_archive ? (
            <p className="text-muted-foreground text-sm">
              Since this is an archived meetup, the new lead organizer will be
              credited as its organizer
              {meetup.organizer_name != null ? (
                <>
                  , replacing{' '}
                  <span className="font-bold">{meetup.organizer_name}</span>
                </>
              ) : null}
              , and <span className="font-bold">you will lose all access</span>{' '}
              to it.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              You&apos;ll remain an organizer with access to manage this meetup
              — you just won&apos;t be the lead organizer.
            </p>
          )}
          <Field>
            <FieldLabel htmlFor="transfer-organizer">
              New lead organizer
            </FieldLabel>
            <OrganizerSelect
              id="transfer-organizer"
              value={transferOrganizerId}
              onChange={setTransferOrganizerId}
              // Can't transfer the meetup to its current lead organizer.
              excludeIds={
                meetup?.lead_organizer != null ? [meetup.lead_organizer.id] : []
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm-transfer">
              Type{' '}
              <span className="font-bold">
                {transferConfirmTarget ?? 'organizer-meetup'}
              </span>{' '}
              to confirm.
            </FieldLabel>
            <Input
              id="confirm-transfer"
              value={transferConfirmText}
              onChange={(event) => setTransferConfirmText(event.target.value)}
              placeholder={transferConfirmTarget ?? 'organizer-meetup'}
              autoComplete="off"
              disabled={selectedOrganizer == null}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                void onTransfer();
              }}
              disabled={!canConfirmTransfer || isTransferring}
            >
              Transfer meetup
              {isTransferring && <Spinner />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator className="my-2" />

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
              Type <span className="font-bold">{meetup?.name}</span> to confirm.
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
              {isDeleting && <Spinner />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DangerZoneCard;
