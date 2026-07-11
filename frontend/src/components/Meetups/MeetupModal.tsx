import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss';
import { cn } from '@/lib/utils';
import { type SimpleTicketInfo } from '@keebmeet/shared';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import {
  FiCalendar,
  FiCheck,
  FiClock,
  FiEdit,
  FiExternalLink,
  FiLink,
  FiMapPin,
  FiUser,
  FiUserCheck,
  FiX,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { socket } from '../../socket';
import { useAppDispatch } from '../../store/hooks';
import { meetupSlice, useGetMeetupQuery } from '../../store/meetupSlice';
import { hasMeetupEnded, isMeetupHappeningNow } from '../../util/timeUtil';
import { isNotFoundError } from '../Guards/Guards';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { MeetupCapacityStatus } from './MeetupCapacityStatus';
import { MeetupGallery } from './MeetupGallery';
import { MeetupRsvpForm } from './MeetupRsvpForm';

dayjs.extend(customParseFormat);

// True at Tailwind's `lg` breakpoint, where the two-column layout fits.
const useIsWide = (): boolean => {
  const [isWide, setIsWide] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (): void => setIsWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isWide;
};

export interface MeetupModalProps {
  meetupId: string;
  isLoggedIn: boolean;
  ticket: SimpleTicketInfo | null;
  isOpen: boolean;
  isRsvp: boolean;
  onClose: () => void;
}

export const MeetupModal = ({
  meetupId,
  isLoggedIn,
  ticket,
  isOpen,
  isRsvp,
  onClose,
}: MeetupModalProps): ReactNode => {
  const { currentData, error } = useGetMeetupQuery(meetupId, {
    skip: meetupId === '',
  });
  const [retainedMeetup, setRetainedMeetup] = useState(currentData);
  useEffect(() => {
    if (currentData != null) setRetainedMeetup(currentData);
  }, [currentData]);
  const meetup =
    currentData ??
    (!isOpen || retainedMeetup?.id === meetupId ? retainedMeetup : undefined);
  const [rsvpPanelOpen, setRsvpPanelOpen] = useState(isRsvp);
  useEffect(() => {
    if (isOpen) setRsvpPanelOpen(isRsvp);
  }, [isOpen, isRsvp]);
  const [retainedTicket, setRetainedTicket] = useState(ticket);
  useEffect(() => {
    if (isOpen) setRetainedTicket(ticket);
  }, [isOpen, ticket]);
  const displayTicket = isOpen ? ticket : retainedTicket;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isWide = useIsWide();

  // Swipe-down-to-dismiss, mobile only (the lg layout is two-column).
  const swipeHandlers = useSwipeToDismiss({
    enabled: !isWide,
    onDismiss: onClose,
  });

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  // A meetup id in the URL that doesn't resolve to a real meetup sends the
  // visitor back to the homepage rather than leaving a dead modal open.
  useEffect(() => {
    if (isNotFoundError(error)) {
      void navigate('/', { replace: true });
    }
  }, [error, navigate]);

  /**
   * Subscribe user to updates for the selected meetup. This will invalidate the
   * cache for the fetched meetup. This is mostly used to update the ticket
   * availability in real time.
   */
  useEffect(() => {
    if (meetup == null) return;

    const onMeetupUpdate = (meetupId: string): void => {
      dispatch(
        meetupSlice.util.invalidateTags([{ type: 'Meetup', id: meetupId }])
      );
    };

    socket.emit('meetup:subscribe', { meetupId });

    socket.on('meetup:update', (payload) => {
      onMeetupUpdate(payload.meetupId);
    });

    // Resubscribe and force update on reconnection after losing connection
    socket.on('connect', () => {
      socket.emit('meetup:subscribe', { meetupId });
      onMeetupUpdate(meetupId);
    });

    // Stay subscribed to updates in case user comes back to page
  }, [meetup]);

  if (meetup == null) return <></>;

  const handleCopyLink = (): void => {
    const url = `${window.location.origin}/meetup/${meetupId}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard');
  };

  const handleCollapse = (): void => {
    void navigate('/meetup/' + meetupId);
  };

  const isHappeningNow = isMeetupHappeningNow(meetup);
  const hasEnded = hasMeetupEnded(meetup);
  // A meetup can be RSVP'd to (or cancelled) right up until it ends.
  const isRsvpable = !hasEnded;
  const isRsvpDisabled = !isLoggedIn || meetup.tickets?.available === 0;
  const goToRsvp = (): void => void navigate('/meetup/' + meetupId + '/rsvp');

  const hasImage = meetup.image_url != null && meetup.image_url !== '';
  const showCapacity = meetup.tickets != null && !meetup.is_archive;
  const showRsvpAction = !isRsvp && isRsvpable;

  const rsvpForm = (
    <div className="sm:w-lg lg:h-full lg:w-96">
      <MeetupRsvpForm
        meetup={meetup}
        isLoggedIn={isLoggedIn}
        ticket={displayTicket}
        onCollapse={handleCollapse}
      />
    </div>
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogOverlay className="backdrop-blur-xs" />
      <DialogContent
        className="flex max-h-[90dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:w-auto lg:max-w-[calc(100vw-2rem)]"
        showCloseButton={false}
        {...swipeHandlers}
      >
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            title="Close"
            aria-label="Close"
            className={cn(
              'absolute top-3 right-3 z-20 size-8',
              hasImage &&
                !rsvpPanelOpen &&
                'rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white'
            )}
          >
            <FiX className="size-4" />
          </Button>
        </DialogClose>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-none lg:flex-row lg:overflow-visible">
          <div
            className={cn(
              'flex-col sm:w-lg lg:min-h-0 lg:shrink-0 lg:overflow-hidden',
              rsvpPanelOpen ? 'hidden lg:flex' : 'flex'
            )}
          >
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {hasImage ? (
                <AspectRatio ratio={2 / 1}>
                  <ImageWithFallback
                    src={meetup.image_url}
                    resizeWidth={768}
                    className={cn(
                      'size-full rounded-tl-md object-cover',
                      !rsvpPanelOpen && 'rounded-tr-md'
                    )}
                  />
                </AspectRatio>
              ) : null}
              <div className="flex flex-col p-4 pb-0">
                <DialogHeader className="space-y-0 text-left">
                  <DialogTitle className="flex flex-row justify-between pb-2 text-2xl font-bold">
                    <div>
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
                    </div>
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

                  {/* Time — hidden for archives, whose time is unknown */}
                  {!meetup.is_archive ? (
                    <div className="flex items-start gap-2">
                      <FiClock className="mt-1 shrink-0" />
                      <p>
                        {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss').format(
                          'h:mm A'
                        )}
                        {' - '}
                        {dayjs(meetup.date, 'YYYY-MM-DDTHH:mm:ss')
                          .add(meetup.duration_hours ?? 0, 'hours')
                          .format('h:mm A')}
                      </p>
                    </div>
                  ) : null}

                  {/* Location */}
                  <div className="flex items-start gap-2">
                    <FiMapPin className="mt-1 shrink-0" />
                    <p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          meetup.location.full_address ?? ''
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {meetup.location.full_address}
                      </a>
                    </p>
                  </div>

                  {/* Organizers — an archive credits its free-text
                      organizer_name when one was given; otherwise fall back to
                      the linked lead/co-organizers. */}
                  {meetup.is_archive && meetup.organizer_name != null ? (
                    <div className="flex items-start gap-2">
                      <FiUser className="mt-1 shrink-0" />
                      <p>Organized by {meetup.organizer_name}</p>
                    </div>
                  ) : meetup.organizers != null ? (
                    <div className="flex items-start gap-2">
                      <FiUser className="mt-1 shrink-0" />
                      <p>
                        Organized by{' '}
                        {new Intl.ListFormat().format(
                          [meetup.lead_organizer, ...meetup.organizers]
                            .filter(
                              (
                                organizer
                              ): organizer is NonNullable<typeof organizer> =>
                                organizer != null
                            )
                            .map((organizer) => organizer.display_name)
                        )}
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Photos */}
                {!rsvpPanelOpen ? (
                  <MeetupGallery
                    meetup={meetup}
                    isAttendee={displayTicket != null}
                  />
                ) : null}

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

            <DialogFooter className="shrink-0 flex-row flex-wrap items-center justify-between gap-3 p-4">
              {showCapacity && meetup.tickets != null ? (
                <MeetupCapacityStatus
                  available={meetup.tickets.available}
                  total={meetup.tickets.total}
                  ended={hasEnded}
                />
              ) : (
                <span />
              )}
              <div className="ml-auto flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Copy link"
                  aria-label="Copy link"
                  onClick={handleCopyLink}
                  className="ml-auto"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copied ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{
                          type: 'spring',
                          stiffness: 1000,
                          damping: 50,
                        }}
                      >
                        <FiCheck className="text-green-600" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="link"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.1 }}
                      >
                        <FiLink />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
                {showRsvpAction ? (
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
                  ) : displayTicket != null ? (
                    <Button
                      variant="outline"
                      disabled={!isLoggedIn}
                      onClick={goToRsvp}
                    >
                      <FiEdit />
                      Manage RSVP
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="default"
                            disabled={isRsvpDisabled}
                            onClick={goToRsvp}
                          >
                            <FiUserCheck />
                            RSVP
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {isRsvpDisabled && (
                        <TooltipContent>
                          {isLoggedIn
                            ? 'No tickets available'
                            : 'Please log in to RSVP'}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                ) : null}
              </div>
            </DialogFooter>
          </div>

          {isWide ? (
            <AnimatePresence initial={false}>
              {rsvpPanelOpen ? (
                <motion.div
                  key="rsvp-panel"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="shrink-0 overflow-hidden lg:min-h-0 lg:border-l"
                >
                  {rsvpForm}
                </motion.div>
              ) : null}
            </AnimatePresence>
          ) : rsvpPanelOpen ? (
            <div className="shrink-0 overflow-hidden">{rsvpForm}</div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
