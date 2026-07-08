import { Spinner } from '@/components/ui/spinner';
import { type MeetupInfo, type SimpleTicketInfo } from '@keebmeet/shared';
import dayjs from 'dayjs';
import { useMemo, type ReactNode } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router-dom';
import { MeetupCard } from '../components/Meetups/MeetupCard';
import { MeetupModal } from '../components/Meetups/MeetupModal';
import Page from '../components/Page/Page';
import { useAppSelector } from '../store/hooks';
import { useGetMeetupsQuery } from '../store/meetupSlice';
import { useMeetupHoverPrefetch } from '../store/useMeetupPrefetch';
import { useGetTicketsQuery } from '../store/ticketSlice';
import {
  hasMeetupEnded,
  hasMeetupStarted,
  isMeetupHappeningNow,
} from '../util/timeUtil';

const Homepage = (): ReactNode => {
  const { isLoggedIn, user } = useAppSelector((state) => state.user);
  const { meetupId: meetupIdParam } = useParams();
  const navigate = useNavigate();
  // The selected meetup is driven by the URL so meetups can be linked to.
  const meetupId = meetupIdParam ?? '';
  const { data: meetups, isLoading } = useGetMeetupsQuery({});
  // TODO(jan): figure out how to remove this ugly ternary without getting linting errors
  const { data: tickets } = useGetTicketsQuery(user != null ? user.id : '', {
    skip: user == null,
  });
  // Warm the modal (details, hero image, photos) on hover so it usually opens
  // instantly on click. Everything prefetched is a no-op when already cached.
  const prefetchMeetup = useMeetupHoverPrefetch();
  // The modal is open whenever a meetup is selected via the URL. The modal
  // itself renders nothing until its data has loaded, so there is no empty flash.
  const isOpen = meetupId !== '';
  const isRsvp = useMatch('/meetup/:meetupId/rsvp') != null;

  const currentMeetups = useMemo(
    () => meetups?.filter((meetup) => isMeetupHappeningNow(meetup)),
    [meetups]
  );

  const futureMeetups = useMemo(
    () => meetups?.filter((meetup) => !hasMeetupStarted(meetup)),
    [meetups]
  );

  const pastMeetups = useMemo(
    () =>
      meetups
        ?.filter((meetup) => hasMeetupEnded(meetup))
        .sort((a, b) => (dayjs(a.date).isBefore(b.date) ? 1 : -1)),
    [meetups]
  );

  /**
   * Get ticket for a meetup if the logged in user is attending the meetup. Otherwise, return null.
   *
   * @param meetupId
   * @returns User's ticket for a meetup or null.
   */
  const getTicketForMeetup = (meetupId: string): SimpleTicketInfo | null => {
    if (user != null && tickets != null) {
      const ticket = tickets.filter(
        (ticket) => ticket.meetup_id === meetupId
      )[0];
      return ticket ?? null;
    }
    return null;
  };

  const meetupCardOnClick = (selectedMeetupId: string): void => {
    void navigate('/meetup/' + selectedMeetupId);
  };

  // Return to the homepage URL when the modal is closed. Clearing the meetup
  // from the URL closes the modal (see isOpen above).
  const handleClose = (): void => {
    void navigate('/');
  };

  const meetupSection = (title: string, meetups: MeetupInfo[]): ReactNode => {
    return (
      <div>
        <h2 className="mb-2 text-3xl font-bold">{title}</h2>
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))] gap-4">
          {meetups?.map((meetup) => (
            <div
              key={meetup.id}
              onClick={() => {
                meetupCardOnClick(meetup.id);
              }}
              onMouseEnter={() => {
                prefetchMeetup(meetup);
              }}
            >
              <MeetupCard
                meetup={meetup}
                attending={getTicketForMeetup(meetup.id) != null}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Page>
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <Spinner className="size-10" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {currentMeetups != null && currentMeetups.length > 0
            ? meetupSection('Happening now', currentMeetups)
            : null}

          {futureMeetups != null && futureMeetups.length > 0
            ? meetupSection('Upcoming meetups', futureMeetups)
            : null}

          {pastMeetups != null && pastMeetups.length > 0
            ? meetupSection('Past meetups', pastMeetups)
            : null}
          <MeetupModal
            meetupId={meetupId}
            ticket={getTicketForMeetup(meetupId)}
            isLoggedIn={isLoggedIn}
            isOpen={isOpen}
            isRsvp={isRsvp}
            onClose={handleClose}
          />
        </div>
      )}
    </Page>
  );
};

export default Homepage;
