import { Button } from '@/components/ui/button';
import dayjs from 'dayjs';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { type MeetupInfo } from '@keebmeet/shared';
import { MeetupOrganizerCard } from '../components/Meetups/MeetupOrganizerCard';
import Page from '../components/Page/Page';
import { useAppSelector } from '../store/hooks';
import { useGetMeetupsQuery } from '../store/meetupSlice';
import {
  hasMeetupEnded,
  hasMeetupStarted,
  isMeetupHappeningNow,
} from '../util/timeUtil';

const OrganizerDashboard = (): ReactNode => {
  const { user } = useAppSelector((state) => state.user);
  const { data: meetups } = useGetMeetupsQuery({
    by_organizer_id: user != null ? [user.id] : [],
    detail_level: 'detailed',
  });
  const navigate = useNavigate();

  const newMeetupOnClick = (): void => {
    void navigate('/new-meetup');
  };

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

  const mapMeetupToCard = (meetup: MeetupInfo): ReactNode => {
    return (
      <MeetupOrganizerCard
        key={meetup.id}
        name={meetup.name}
        date={meetup.date}
        imageUrl={meetup.image_url}
        ticketsAvailable={meetup.tickets?.available ?? NaN}
        ticketsTotal={meetup.tickets?.total ?? NaN}
        onClick={() => {
          void navigate(`/meetup/${meetup.id}/manage`);
        }}
      />
    );
  };

  const meetupSection = (title: string, meetups: MeetupInfo[]): ReactNode => {
    return (
      <div>
        <h2 className="mb-2 text-2xl font-medium">{title}</h2>
        <div className="flex flex-col gap-4">
          {meetups.map(mapMeetupToCard)}
        </div>
      </div>
    );
  };

  return (
    <Page>
      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-4 flex items-center">
          <h1 className="text-2xl font-semibold">Your Meetups</h1>
          <Button className="ml-auto" onClick={newMeetupOnClick}>
            New meetup
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          {currentMeetups != null && currentMeetups.length > 0
            ? meetupSection('Happening now', currentMeetups)
            : null}
          {futureMeetups != null && futureMeetups.length > 0
            ? meetupSection('Upcoming meetups', futureMeetups)
            : null}
          {pastMeetups != null && pastMeetups.length > 0
            ? meetupSection('Past meetups', pastMeetups)
            : null}
        </div>
      </div>
    </Page>
  );
};

export default OrganizerDashboard;
