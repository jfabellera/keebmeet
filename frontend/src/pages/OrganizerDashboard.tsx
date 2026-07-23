import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { type MeetupInfo } from '@keebmeet/shared';
import dayjs from 'dayjs';
import { ArchiveIcon, ArrowLeftIcon, MoreHorizontalIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MeetupOrganizerCard } from '../components/Meetups/MeetupOrganizerCard';
import { MeetupSearchInput } from '../components/Meetups/MeetupSearchInput';
import Page from '../components/Page/Page';
import { useIsMobile } from '../hooks/use-mobile';
import { useMeetupSearch } from '../hooks/useMeetupSearch';
import { useAppSelector } from '../store/hooks';
import { meetupSlice, useGetMeetupsQuery } from '../store/meetupSlice';
import {
  hasMeetupEnded,
  hasMeetupStarted,
  isMeetupHappeningNow,
} from '../util/timeUtil';

const OrganizerDashboard = (): ReactNode => {
  const { user } = useAppSelector((state) => state.user);
  const isMobile = useIsMobile();
  const {
    searchInput,
    setSearchInput,
    searchExpanded,
    setSearchExpanded,
    debouncedSearch,
    byName,
  } = useMeetupSearch();

  const { data: meetups, isLoading } = useGetMeetupsQuery({
    by_organizer_id: user != null ? [user.id] : [],
    by_name: byName,
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

  const sections: { title: string; meetups: MeetupInfo[] }[] = [];
  if (currentMeetups != null && currentMeetups.length > 0) {
    sections.push({ title: 'Happening now', meetups: currentMeetups });
  }
  if (futureMeetups != null && futureMeetups.length > 0) {
    sections.push({ title: 'Upcoming meetups', meetups: futureMeetups });
  }
  if (pastMeetups != null && pastMeetups.length > 0) {
    sections.push({ title: 'Past meetups', meetups: pastMeetups });
  }

  const searchControl = (
    <div className="flex shrink-0 items-center gap-1">
      <MeetupSearchInput
        value={searchInput}
        onChange={setSearchInput}
        expanded={searchExpanded}
        onExpandedChange={setSearchExpanded}
        expandInline={!isMobile}
      />
    </div>
  );

  const meetupCards = (meetups: MeetupInfo[]): ReactNode => (
    <div className="flex flex-col gap-4">{meetups.map(mapMeetupToCard)}</div>
  );

  const sectionHeader = (
    title: string | undefined,
    count: number | undefined,
    trailing?: ReactNode
  ): ReactNode => (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-muted-foreground shrink-0 text-xs font-semibold tracking-[0.14em] uppercase">
        {title}
      </h2>
      <Separator className="flex-1" />
      {count != null ? (
        <span className="text-muted-foreground text-xs tabular-nums">
          {count}
        </span>
      ) : null}
      {trailing}
    </div>
  );

  return (
    <Page>
      <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigate('/');
          }}
          className="text-muted-foreground -mt-1 mb-2 -ml-2 h-8 w-fit gap-1.5 px-2"
        >
          <ArrowLeftIcon className="size-4" />
          Back to home
        </Button>
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Your Meetups</h1>
          <div className="ml-auto">{searchControl}</div>
          <ButtonGroup>
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
        {isMobile && searchExpanded ? (
          <div className="mb-4">
            <MeetupSearchInput
              fullWidth
              value={searchInput}
              onChange={setSearchInput}
              expanded={searchExpanded}
              onExpandedChange={setSearchExpanded}
            />
          </div>
        ) : null}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-10" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              {sectionHeader(sections[0]?.title, sections[0]?.meetups.length)}
              {sections[0] != null ? meetupCards(sections[0].meetups) : null}
            </div>

            {sections.slice(1).map((section) => (
              <div key={section.title}>
                {sectionHeader(section.title, section.meetups.length)}
                {meetupCards(section.meetups)}
              </div>
            ))}

            {sections.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {debouncedSearch !== ''
                  ? 'No meetups match your search.'
                  : 'No meetups yet.'}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Page>
  );
};

export default OrganizerDashboard;
