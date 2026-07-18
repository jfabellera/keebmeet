import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { type MeetupInfo } from '@keebmeet/shared';
import dayjs from 'dayjs';
import { ArchiveIcon, MoreHorizontalIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MeetupOrganizerCard } from '../components/Meetups/MeetupOrganizerCard';
import Page from '../components/Page/Page';
import BackButton from '../components/shared/BackButton';
import { useAppSelector } from '../store/hooks';
import { meetupSlice, useGetMeetupsQuery } from '../store/meetupSlice';
import {
  hasMeetupEnded,
  hasMeetupStarted,
  isMeetupHappeningNow,
} from '../util/timeUtil';

const OrganizerDashboard = (): ReactNode => {
  const { user } = useAppSelector((state) => state.user);
  const { data: meetups, isLoading } = useGetMeetupsQuery({
    by_organizer_id: user != null ? [user.id] : [],
    detail_level: 'detailed',
  });
  const navigate = useNavigate();
  const prefetchMeetup = meetupSlice.usePrefetch('getMeetup');

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
        slug={meetup.slug}
        date={meetup.date}
        imageUrl={meetup.image_url}
        ticketsAvailable={meetup.tickets?.available ?? NaN}
        ticketsTotal={meetup.tickets?.total ?? NaN}
        isUnlisted={meetup.is_unlisted}
        onClick={() => {
          void navigate(`/meetup/${meetup.slug}/manage`);
        }}
        onMouseEnter={() => {
          prefetchMeetup(meetup.slug);
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
      <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
        <div className="mb-4 flex items-center gap-2">
          <BackButton to="/" label="Back to home" className="-ml-2 shrink-0" />
          <h1 className="text-2xl font-semibold">Your Meetups</h1>
          <ButtonGroup className="ml-auto">
            <Button onClick={newMeetupOnClick}>New meetup</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" aria-label="More Options">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => {
                      void navigate('/new-meetup/archive');
                    }}
                  >
                    <ArchiveIcon />
                    Add archive meetup
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-10" />
          </div>
        ) : (
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
        )}
      </div>
    </Page>
  );
};

export default OrganizerDashboard;
