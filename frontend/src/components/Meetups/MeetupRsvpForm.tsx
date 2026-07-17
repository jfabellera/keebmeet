import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Spinner } from '@/components/ui/spinner';
import { type MeetupInfo, type SimpleTicketInfo } from '@keebmeet/shared';
import { useFormik } from 'formik';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FiArrowLeft, FiLock, FiUserCheck, FiUserX } from 'react-icons/fi';
import { toast } from 'sonner';
import * as Yup from 'yup';
import { useAppSelector } from '../../store/hooks';
import {
  useCreateTicketMutation,
  useDeleteTicketMutation,
  useGetTicketQuery,
  useUpdateTicketMutation,
} from '../../store/ticketSlice';
import { useGetUserQuery } from '../../store/userSlice';
import { hasMeetupEnded } from '../../util/timeUtil';

const TicketHolderSchema = Yup.object().shape({
  displayName: Yup.string().required('Required'),
  firstName: Yup.string().required('Required'),
  lastName: Yup.string().required('Required'),
  email: Yup.string().email('Invalid email').required('Required'),
});

interface MeetupRsvpFormProps {
  meetup: MeetupInfo;
  isLoggedIn: boolean;
  ticket: SimpleTicketInfo | null;
  onCollapse: () => void;
}

export const MeetupRsvpForm = ({
  meetup,
  isLoggedIn,
  ticket,
  onCollapse,
}: MeetupRsvpFormProps): ReactNode => {
  const { user } = useAppSelector((state) => state.user);

  const { data: fullUser } = useGetUserQuery(user?.id ?? '', {
    skip: user == null,
  });

  const [isManaging, setIsManaging] = useState(ticket != null);
  const submittedRef = useRef(false);
  useEffect(() => {
    if (!submittedRef.current) setIsManaging(ticket != null);
  }, [ticket]);
  const { data: ticketDetails } = useGetTicketQuery(ticket?.id ?? '', {
    skip: ticket == null,
  });

  const [rsvp, { isLoading: isRsvping }] = useCreateTicketMutation();
  const [updateTicket, { isLoading: isUpdating }] = useUpdateTicketMutation();
  const [deleteTicket, { isLoading: isCancelling }] = useDeleteTicketMutation();
  const isBusy = isRsvping || isUpdating || isCancelling;

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const hasEnded = hasMeetupEnded(meetup);

  const formik = useFormik({
    // When managing, prefill from the existing ticket; otherwise from the
    // fetched user. Reinitialised once either loads. Editable so the user can
    // RSVP / manage on someone else's behalf.
    initialValues: {
      displayName:
        ticketDetails?.ticket_holder_display_name ??
        fullUser?.display_name ??
        '',
      firstName:
        ticketDetails?.ticket_holder_first_name ?? fullUser?.first_name ?? '',
      lastName:
        ticketDetails?.ticket_holder_last_name ?? fullUser?.last_name ?? '',
      email: ticketDetails?.ticket_holder_email ?? fullUser?.email ?? '',
    },
    enableReinitialize: true,
    validationSchema: TicketHolderSchema,
    onSubmit: (values) => {
      void (async () => {
        // Latch the mode before the mutation so the ticket-cache update it
        // triggers can't flip the copy while the panel collapses.
        submittedRef.current = true;
        const ticketHolder = {
          display_name: values.displayName,
          first_name: values.firstName,
          last_name: values.lastName,
          email: values.email,
        };
        try {
          if (ticket != null) {
            await updateTicket({
              ticketId: ticket.id,
              ticketHolder,
            }).unwrap();
            toast.success('Your RSVP details were updated.');
          } else {
            await rsvp({ meetupId: meetup.id, ticketHolder }).unwrap();
            toast.success(`You're going to ${meetup.name}!`);
          }
          onCollapse();
        } catch {
          toast.error('Something went wrong. Please try again.');
        }
      })();
    },
  });

  const onCancelRsvp = (): void => {
    void (async () => {
      if (ticket == null) return;
      submittedRef.current = true;
      try {
        await deleteTicket(ticket.id).unwrap();
        setCancelConfirmOpen(false);
        toast.success('Your RSVP was cancelled.');
        onCollapse();
      } catch {
        toast.error('Could not cancel your RSVP. Please try again.');
      }
    })();
  };

  return (
    <form
      onSubmit={formik.handleSubmit}
      noValidate
      className="flex h-full flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-2 shrink-0"
            aria-label="Back to details"
            onClick={onCollapse}
          >
            <FiArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isManaging ? 'Manage your RSVP' : 'Confirm your RSVP'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isManaging
                ? 'Update your details for '
                : 'Reserve your spot at '}
              <span className="font-semibold">{meetup.name}</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-md font-semibold">Ticket holder details</p>
          <FormField
            formik={formik}
            name="displayName"
            label="Display Name"
            disabled={!isLoggedIn}
          />
          {/* Name and email come from the account and can't be edited here;
            change them in account settings. Shown read-only for context. */}
          <div className="border-border flex flex-col gap-4 rounded-md border border-dashed p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <FiLock className="size-3 shrink-0" />
              From your account · only visible to organizers
            </p>
            <div className="flex flex-row gap-2">
              <FormField
                formik={formik}
                name="firstName"
                label="First Name"
                className="flex-1"
                disabled
              />
              <FormField
                formik={formik}
                name="lastName"
                label="Last Name"
                className="flex-1"
                disabled
              />
            </div>
            <FormField
              formik={formik}
              name="email"
              label="Email"
              type="email"
              disabled
            />
          </div>
        </div>

        {hasEnded ? (
          <p className="text-sm font-semibold text-red-500">
            This meetup has already ended.
          </p>
        ) : !isLoggedIn ? (
          <p className="text-sm font-semibold text-yellow-600">
            You must be logged in to RSVP.
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-3 p-4">
        <Button
          type="submit"
          size="lg"
          disabled={!isLoggedIn || hasEnded || isBusy || !formik.isValid}
        >
          <FiUserCheck />
          {isManaging ? 'Update RSVP' : 'Confirm RSVP'}
          {(isRsvping || isUpdating) && <Spinner />}
        </Button>
        {isManaging ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setCancelConfirmOpen(true)}
            disabled={!isLoggedIn || hasEnded || isBusy}
          >
            <FiUserX />
            Cancel RSVP
          </Button>
        ) : null}
      </div>

      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your RSVP?</DialogTitle>
            <DialogDescription>
              This will release your spot at {meetup.name}. You can RSVP again
              later if there's still room.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Keep RSVP
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={onCancelRsvp}
              disabled={isBusy}
            >
              <FiUserX />
              Cancel RSVP
              {isCancelling && <Spinner />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
};
