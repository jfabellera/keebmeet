import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type MeetupInfo, type SimpleTicketInfo } from '@keebmeet/shared';
import dayjs from 'dayjs';
import { ArrowLeftIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { FiAward, FiCalendar, FiImage, FiUser, FiUsers } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { GalleryActions } from '../components/Meetups/GalleryActions';
import { GalleryCard } from '../components/Meetups/GalleryCard';
import { MeetupCard } from '../components/Meetups/MeetupCard';
import { MeetupModal } from '../components/Meetups/MeetupModal';
import Page from '../components/Page/Page';
import { useGetUserGalleriesQuery } from '../store/gallerySlice';
import { useAppSelector } from '../store/hooks';
import { useGetMeetupsQuery } from '../store/meetupSlice';
import { useGetTicketsQuery } from '../store/ticketSlice';
import { useGetPublicUserQuery } from '../store/userSlice';
import { hasMeetupEnded } from '../util/timeUtil';

const ProfilePage = (): ReactNode => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAppSelector((state) => state.user);

  // The open meetup is local state, not the URL: on a profile page the modal
  // expands in place rather than routing back to the homepage.
  const [selectedSlug, setSelectedSlug] = useState('');

  // Navigating to another user (e.g. via an organizer link inside the modal)
  // reuses this component, so close any open meetup on that switch.
  const [renderedUsername, setRenderedUsername] = useState(username);
  if (username !== renderedUsername) {
    setRenderedUsername(username);
    setSelectedSlug('');
  }

  const { data: profileUser, isLoading: isUserLoading } = useGetPublicUserQuery(
    username ?? '',
    { skip: username == null }
  );

  const isOrganizer = profileUser?.is_organizer === true;
  const notFound = !isUserLoading && username != null && profileUser == null;

  // Only organizers have meetups to list; filter by the numeric id resolved
  // from the username.
  const organizerId = profileUser?.id;
  const { data: meetups, isLoading: isMeetupsLoading } = useGetMeetupsQuery(
    {
      by_organizer_id: organizerId != null ? [organizerId] : [],
      detail_level: 'detailed',
    },
    { skip: organizerId == null || !isOrganizer }
  );
  const isLoading = isUserLoading || (isOrganizer && isMeetupsLoading);

  // The logged-in user's tickets let the modal reflect their RSVP state
  const { data: tickets } = useGetTicketsQuery(user != null ? user.id : '', {
    skip: user == null,
  });

  // Galleries aren't organizer-gated.
  const { data: galleries = [] } = useGetUserGalleriesQuery(username ?? '', {
    skip: username == null,
  });

  // Editing/deleting a gallery is gated to the profile's own owner.
  const isOwnProfile = user != null && user.id === profileUser?.id;

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
                setSelectedSlug(meetup.slug);
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

  const meetupsContent = (
    <div className="flex flex-col gap-8">
      {upcomingMeetups.length > 0
        ? meetupSection('Upcoming', upcomingMeetups)
        : null}
      {pastMeetups.length > 0 ? meetupSection('Past', pastMeetups) : null}
    </div>
  );

  const galleriesContent = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {galleries.map((gallery) => (
        <GalleryCard
          key={gallery.id}
          gallery={gallery.gallery}
          preview={gallery.preview}
          subtitle={gallery.meetup_title}
          actions={
            <GalleryActions
              meetupId={gallery.meetup_id}
              photo={gallery}
              isOwn={isOwnProfile}
              onOpenMeetup={() => setSelectedSlug(gallery.meetup_slug)}
            />
          }
        />
      ))}
    </div>
  );

  // A tab shows only when it has content; a lone tab acts as the label.
  const hasMeetups = isOrganizer && total > 0;
  const hasGalleries = galleries.length > 0;

  return (
    <Page>
      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <Spinner className="size-10" />
        </div>
      ) : notFound ? (
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
          <FiUser className="size-8 opacity-60" />
          <p>User not found.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigate('/');
            }}
            className="gap-1.5"
          >
            <ArrowLeftIcon className="size-4" />
            Back to home
          </Button>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
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
              <AvatarImage
                src={profileUser?.photo_url ?? ''}
                resizeWidth={256}
              />
              <AvatarFallback>
                <FiUser className="size-8 sm:size-9" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col items-start gap-1.5 sm:gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="text-xl font-bold sm:text-2xl">
                  {profileUser?.display_name ?? 'User'}
                </h1>
                {isOrganizer ? (
                  <Badge variant="secondary" className="gap-1">
                    <FiAward />
                    Organizer
                  </Badge>
                ) : null}
              </div>
              {isOrganizer ? (
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
              ) : null}
            </div>
          </div>

          {hasMeetups || hasGalleries ? (
            <Tabs
              defaultValue={hasMeetups ? 'meetups' : 'galleries'}
              className="gap-0"
            >
              <TabsList>
                {hasMeetups ? (
                  <TabsTrigger value="meetups">
                    <FiCalendar />
                    Meetups
                  </TabsTrigger>
                ) : null}
                {hasGalleries ? (
                  <TabsTrigger value="galleries">
                    <FiImage />
                    Galleries
                  </TabsTrigger>
                ) : null}
              </TabsList>
              {hasMeetups ? (
                <TabsContent value="meetups" className="mt-4">
                  {meetupsContent}
                </TabsContent>
              ) : null}
              {hasGalleries ? (
                <TabsContent value="galleries" className="mt-4">
                  {galleriesContent}
                </TabsContent>
              ) : null}
            </Tabs>
          ) : isOrganizer ? (
            <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
              <FiCalendar className="size-8 opacity-60" />
              <p>No meetups organized yet.</p>
            </div>
          ) : null}

          <MeetupModal
            meetupId={selectedSlug}
            ticket={getTicketForMeetup(
              organizerMeetups.find((meetup) => meetup.slug === selectedSlug)
                ?.id ?? ''
            )}
            isLoggedIn={isLoggedIn}
            isOpen={selectedSlug !== ''}
            isRsvp={false}
            onClose={() => {
              setSelectedSlug('');
            }}
          />
        </div>
      )}
    </Page>
  );
};

export default ProfilePage;
