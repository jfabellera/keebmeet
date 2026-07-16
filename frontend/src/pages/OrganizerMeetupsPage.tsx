import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { type MeetupInfo, type SimpleTicketInfo } from '@keebmeet/shared';
import dayjs from 'dayjs';
import { ArrowLeftIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { FiAward, FiCalendar, FiUser, FiUsers } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { MeetupCard } from '../components/Meetups/MeetupCard';
import { MeetupModal } from '../components/Meetups/MeetupModal';
import Page from '../components/Page/Page';
import { useAppSelector } from '../store/hooks';
import { useGetMeetupsQuery } from '../store/meetupSlice';
import { useGetTicketsQuery } from '../store/ticketSlice';
import { useGetPublicUserQuery } from '../store/userSlice';
import { hasMeetupEnded } from '../util/timeUtil';

const OrganizerMeetupsPage = (): ReactNode => {
  const { organizerId } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAppSelector((state) => state.user);

  // The open meetup is local state, not the URL: on a profile page the modal
  // expands in place rather than routing back to the homepage.
  const [selectedMeetupId, setSelectedMeetupId] = useState('');

  // Navigating to another organizer (e.g. via an organizer link inside the
  // modal) reuses this component, so close any open meetup on that switch.
  const [renderedOrganizerId, setRenderedOrganizerId] = useState(organizerId);
  if (organizerId !== renderedOrganizerId) {
    setRenderedOrganizerId(organizerId);
    setSelectedMeetupId('');
  }

  const { data: organizer } = useGetPublicUserQuery(organizerId ?? '', {
    skip: organizerId == null,
  });

  const { data: meetups, isLoading } = useGetMeetupsQuery(
    {
      by_organizer_id: organizerId != null ? [organizerId] : [],
      detail_level: 'detailed',
    },
    { skip: organizerId == null }
  );

  // The logged-in user's tickets let the modal reflect their RSVP state
  const { data: tickets } = useGetTicketsQuery(user != null ? user.id : '', {
    skip: user == null,
  });

  const getTicketForMeetup = (meetupId: string): SimpleTicketInfo | null => {
    if (user != null && tickets != null) {
      return tickets.find((ticket) => ticket.meetup_id === meetupId) ?? null;
    }
    return null;
  };

  // Exclude archives credited to someone else those aren't this profile's
  // meetups even if it's their lead_organizer.
  const organizerMeetups = useMemo(
    () =>
      meetups?.filter(
        (meetup) => !(meetup.is_archive && meetup.organizer_name != null)
      ) ?? [],
    [meetups]
  );

  const upcomingMeetups = useMemo(
    () => organizerMeetups.filter((meetup) => !hasMeetupEnded(meetup)),
    [organizerMeetups]
  );

  const pastMeetups = useMemo(
    () =>
      organizerMeetups
        .filter((meetup) => hasMeetupEnded(meetup))
        .sort((a, b) => (dayjs(a.date).isBefore(b.date) ? 1 : -1)),
    [organizerMeetups]
  );

  const hostCount = useMemo(
    () =>
      organizerMeetups.filter(
        (meetup) => meetup.lead_organizer?.id === organizerId
      ).length,
    [organizerMeetups, organizerId]
  );

  const coHostCount = useMemo(
    () =>
      organizerMeetups.filter((meetup) =>
        meetup.organizers?.some((organizer) => organizer.id === organizerId)
      ).length,
    [organizerMeetups, organizerId]
  );

  const meetupSection = (
    label: string,
    sectionMeetups: MeetupInfo[]
  ): ReactNode => {
    return (
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
            {label}
          </h2>
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs tabular-nums">
            {sectionMeetups.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-4">
          {sectionMeetups.map((meetup) => (
            <div
              key={meetup.id}
              onClick={() => {
                setSelectedMeetupId(meetup.id);
              }}
            >
              <MeetupCard
                meetup={meetup}
                attending={getTicketForMeetup(meetup.id) != null}
                imageOverlay={
                  meetup.organizers?.some(
                    (organizer) => organizer.id === organizerId
                  ) ? (
                    <Badge
                      variant="secondary"
                      className="bg-background/90 text-foreground gap-1 border shadow-sm backdrop-blur-sm"
                    >
                      <FiUsers />
                      Co-host
                    </Badge>
                  ) : null
                }
              />
            </div>
          ))}
        </div>
      </section>
    );
  };

  const total = organizerMeetups.length;

  return (
    <Page>
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <Spinner className="size-10" />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigate('/');
            }}
            className="text-muted-foreground -mt-1 -mb-4 -ml-2 h-8 w-fit gap-1.5 px-2"
          >
            <ArrowLeftIcon className="size-4" />
            Back to home
          </Button>
          <div className="bg-card flex flex-row items-center gap-4 rounded-xl border p-4 shadow-sm sm:gap-5 sm:px-6 sm:py-6">
            <Avatar className="size-16 shrink-0 sm:size-24">
              <AvatarImage src={organizer?.photo_url ?? ''} resizeWidth={256} />
              <AvatarFallback>
                <FiUser className="size-8 sm:size-9" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col items-start gap-1.5 sm:gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="text-xl font-bold sm:text-2xl">
                  {organizer?.display_name ?? 'Organizer'}
                </h1>
                <Badge variant="secondary" className="gap-1">
                  <FiAward />
                  Organizer
                </Badge>
              </div>
              <div className="flex flex-col items-start gap-0.5">
                <p className="flex items-baseline gap-1.5">
                  <span className="text-xl font-semibold tabular-nums">
                    {total}
                  </span>
                  <span className="text-muted-foreground">
                    {total === 1 ? 'meetup' : 'meetups'}
                  </span>
                </p>
                <p className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium tabular-nums">
                    {hostCount}
                  </span>{' '}
                  hosted
                  <span className="px-1.5">·</span>
                  <span className="text-foreground font-medium tabular-nums">
                    {coHostCount}
                  </span>{' '}
                  co-hosted
                </p>
              </div>
            </div>
          </div>

          {upcomingMeetups.length > 0
            ? meetupSection('Upcoming', upcomingMeetups)
            : null}

          {pastMeetups.length > 0 ? meetupSection('Past', pastMeetups) : null}

          {total === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
              <FiCalendar className="size-8 opacity-60" />
              <p>No meetups organized yet.</p>
            </div>
          ) : null}

          <MeetupModal
            meetupId={selectedMeetupId}
            ticket={getTicketForMeetup(selectedMeetupId)}
            isLoggedIn={isLoggedIn}
            isOpen={selectedMeetupId !== ''}
            isRsvp={false}
            onClose={() => {
              setSelectedMeetupId('');
            }}
          />
        </div>
      )}
    </Page>
  );
};

export default OrganizerMeetupsPage;
