import dayjs from 'dayjs';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { type MeetupInfo } from '../../../backend/src/controllers/meetups';
import { type SimpleTicketInfo } from '../../../backend/src/controllers/tickets';
import { MeetupCard } from '../components/Meetups/MeetupCard';
import { MeetupModal } from '../components/Meetups/MeetupModal';
import Page from '../components/Page/Page';
import { useAppSelector } from '../store/hooks';
import { useGetMeetupsQuery } from '../store/meetupSlice';
import { useGetTicketsQuery } from '../store/ticketSlice';
import {
  hasMeetupEnded,
  hasMeetupStarted,
  isMeetupHappeningNow,
} from '../util/timeUtil';
import { useDisclosure } from '@/hooks/useDisclosure';

const Homepage = (): ReactNode => {
  const { isLoggedIn, user } = useAppSelector((state) => state.user);
  const [meetupId, setMeetupId] = useState<number>(0);
  const { data: meetups, isLoading } = useGetMeetupsQuery({});
  // TODO(jan): figure out how to remove this ugly ternary without getting linting errors
  const { data: tickets } = useGetTicketsQuery(user != null ? user.id : 0, {
    skip: user == null,
  });
  const { isOpen, onOpen, onClose } = useDisclosure();

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

  // Reset meetupID when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setMeetupId(0);
    }
  }, [isOpen]);

  /**
   * Get ticket for a meetup if the logged in user is attending the meetup. Otherwise, return null.
   *
   * @param meetupId
   * @returns User's ticket for a meetup or null.
   */
  const getTicketForMeetup = (meetupId: number): SimpleTicketInfo | null => {
    if (user != null && tickets != null) {
      const ticket = tickets.filter(
        (ticket) => ticket.meetup_id === meetupId
      )[0];
      return ticket ?? null;
    }
    return null;
  };

  const meetupCardOnClick = (selectedMeetupId: number): void => {
    setMeetupId(selectedMeetupId);

    // Only open modal immediately if the selected meetup is already loaded
    if (selectedMeetupId === meetupId) {
      onOpen();
    }
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
        <></>
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
            onClose={onClose}
            onOpen={onOpen}
          />
        </div>
      )}
    </Page>
  );
};

export default Homepage;
