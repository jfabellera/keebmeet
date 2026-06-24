import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useEffect, type ReactNode } from 'react';
import {
  FiCalendar,
  FiClock,
  FiExternalLink,
  FiMapPin,
  FiUser,
  FiUserCheck,
  FiUserX,
} from 'react-icons/fi';
import { type SimpleTicketInfo } from '../../../../backend/src/controllers/tickets';
import { socket } from '../../socket';
import { useAppDispatch } from '../../store/hooks';
import { meetupSlice, useGetMeetupQuery } from '../../store/meetupSlice';
import {
  useCreateTicketMutation,
  useDeleteTicketMutation,
} from '../../store/ticketSlice';
import { hasMeetupEnded, isMeetupHappeningNow } from '../../util/timeUtil';
import { MeetupCapacityStatus } from './MeetupCapacityStatus';

dayjs.extend(customParseFormat);

export interface MeetupModalProps {
  meetupId: number;
  isLoggedIn: boolean;
  ticket: SimpleTicketInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export const MeetupModal = ({
  meetupId,
  isLoggedIn,
  ticket,
  isOpen,
  onClose,
  onOpen,
}: MeetupModalProps): ReactNode => {
  const { data: meetup, refetch: refetchMeetup } = useGetMeetupQuery(meetupId, {
    skip: meetupId < 1,
  });
  const [rsvp] = useCreateTicketMutation();
  const [unrsvp] = useDeleteTicketMutation();
  const dispatch = useAppDispatch();

  /**
   * Subscribe user to updates for the selected meetup. This will invalidate the
   * cache for the fetched meetup. This is mostly used to update the ticket
   * availability in real time.
   */
  useEffect(() => {
    if (meetup == null) return;

    const onMeetupUpdate = (meetupId: number): void => {
      dispatch(
        meetupSlice.util.invalidateTags([{ type: 'Meetup', id: meetupId }])
      );
    };

    socket.emit('meetup:subscribe', { meetupId: Number(meetupId) });

    socket.on('meetup:update', (payload) => {
      onMeetupUpdate(payload.meetupId);
    });

    // Resubscribe and force update on reconnection after losing connection
    socket.on('connect', () => {
      socket.emit('meetup:subscribe', { meetupId: Number(meetupId) });
      onMeetupUpdate(Number(meetupId));
    });

    // Stay subscribed to updates in case user comes back to page
  }, [meetup]);

  // Open modal once meetup is loaded
  useEffect(() => {
    if (meetupId !== 0) {
      onOpen();
    }
  }, [meetup]);

  /**
   * RSVP for meetup and refetch meetup info to update count
   */
  const rsvpOnclick = (): void => {
    // void to match onClick expected type
    void (async () => {
      if (meetup != null) {
        await rsvp(meetup.id);
        await refetchMeetup();
      }
    })();
  };

  /**
   * Remove RSVP for meetup and refetch meetup info to update count
   */
  const unrsvpOnClick = (): void => {
    // void to match onClick expected type
    void (async () => {
      if (ticket != null) {
        await unrsvp(ticket.id);
        await refetchMeetup();
      }
    })();
  };

  if (meetup == null) return <></>;

  const isHappeningNow = isMeetupHappeningNow(meetup);
  const hasEnded = hasMeetupEnded(meetup);
  // A meetup can be RSVP'd to (or cancelled) right up until it ends.
  const isRsvpable = !hasEnded;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogOverlay className="backdrop-blur-xs" />
      <DialogContent
        className="gap-0 overflow-auto p-0 sm:max-h-[90vh]"
        showCloseButton={false}
      >
        <div className="overflow-y-auto">
          {meetup.image_url != null && meetup.image_url !== '' ? (
            <AspectRatio ratio={2 / 1}>
              <ImageWithFallback
                src={meetup.image_url}
                className="size-full rounded-t-md object-cover"
              />
            </AspectRatio>
          ) : null}
          <div className="flex flex-col p-4 pb-0">
            <DialogHeader className="space-y-0 text-left">
              <DialogTitle className="pb-2 text-2xl font-bold">
                {meetup.name}
                {isHappeningNow ? (
                  <Badge className="ml-3 -translate-y-0.5 bg-green-600 align-middle text-white">
                    <span className="size-1.5 animate-pulse rounded-full bg-white" />
                    Happening now
                  </Badge>
                ) : hasEnded ? (
                  <Badge
                    variant="secondary"
                    className="ml-3 -translate-y-0.5 align-middle"
                  >
                    Ended
                  </Badge>
                ) : null}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1 pb-4 font-semibold">
              {/* Date */}
              <div className="flex items-start gap-2">
                <FiCalendar className="mt-1 shrink-0" />
                <p>
                  {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format(
                    'MMMM DD, YYYY'
                  )}
                </p>
              </div>

              {/* Time */}
              <div className="flex items-start gap-2">
                <FiClock className="mt-1 shrink-0" />
                <p>
                  {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format('h:mm A')}
                  {' - '}
                  {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss')
                    .add(meetup.duration_hours ?? 0, 'hours')
                    .format('h:mm A')}
                </p>
              </div>

              {/* Location */}
              <div className="flex items-start gap-2">
                <FiMapPin className="mt-1 shrink-0" />
                <p>{meetup.location.full_address}</p>
              </div>

              {/* Organizers */}
              {meetup.organizers != null ? (
                <div className="flex items-start gap-2">
                  <FiUser className="mt-1 shrink-0" />
                  <p>
                    Organized by{' '}
                    {new Intl.ListFormat().format(meetup.organizers)}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Description */}
            {meetup.description !== '' ? (
              <>
                <p className="font-semibold">Description</p>
                <p className="whitespace-pre-line">{meetup.description}</p>
              </>
            ) : (
              <p>
                <i>No description</i>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row flex-wrap items-center justify-between gap-3 p-4">
          {meetup.tickets != null ? (
            <MeetupCapacityStatus
              available={meetup.tickets.available}
              total={meetup.tickets.total}
            />
          ) : (
            <span />
          )}
          <div className="ml-auto flex items-center gap-3">
            {isRsvpable ? (
              meetup.eventbrite_url != null ? (
                <a
                  href={meetup.eventbrite_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button>
                    <FiExternalLink />
                    RSVP
                  </Button>
                </a>
              ) : ticket != null ? (
                <Button
                  variant="destructive"
                  disabled={!isLoggedIn}
                  onClick={unrsvpOnClick}
                >
                  <FiUserX />
                  Cancel RSVP
                </Button>
              ) : (
                <Button
                  variant="default"
                  disabled={!isLoggedIn}
                  onClick={rsvpOnclick}
                >
                  <FiUserCheck />
                  RSVP
                </Button>
              )
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
