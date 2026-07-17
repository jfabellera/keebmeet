import { useEffect, useState, type ReactNode } from 'react';
import { FiGift, FiHome, FiMonitor, FiSettings, FiUsers } from 'react-icons/fi';
import { IoTicketOutline } from 'react-icons/io5';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Page from '../components/Page/Page';
import { type SidebarItem } from '../components/Sidebar/Sidebar';
import { socket } from '../socket';
import { useAppDispatch } from '../store/hooks';
import { meetupSlice, useGetMeetupQuery } from '../store/meetupSlice';
import { organizerSlice } from '../store/organizerSlice';

interface ManageMeetupPageProps {
  children: ReactNode;
}

const ManageMeetupPage = ({ children }: ManageMeetupPageProps): ReactNode => {
  const { meetupId } = useParams();
  const { data: meetup } = useGetMeetupQuery(meetupId ?? '');
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isArchive = meetup?.is_archive === true;

  /**
   * Subscribe user to updates for the selected meetup. This will invalidate the
   * cache for the fetched meetup and attendees whenever a meetup is updated.
   */
  useEffect(() => {
    if (meetup == null) return;

    // Socket rooms and the attendee/raffle caches are keyed by the numeric id;
    // the getMeetup cache tag by slug.
    const invalidate = (): void => {
      dispatch(
        meetupSlice.util.invalidateTags([{ type: 'Meetup', id: meetup.slug }])
      );
      dispatch(
        organizerSlice.util.invalidateTags([
          { type: 'Attendees', id: meetup.id },
        ])
      );
      dispatch(
        organizerSlice.util.invalidateTags([
          'Raffle',
          { type: 'Raffles', id: meetup.id },
        ])
      );
    };

    socket.emit('meetup:subscribe', { meetupId: meetup.id });

    socket.on('meetup:update', () => {
      invalidate();
    });

    // Resubscribe and force update on reconnection after losing connection
    socket.on('connect', () => {
      socket.emit('meetup:subscribe', { meetupId: meetup.id });
      invalidate();
    });

    // Stay subscribed to updates in case user comes back to page
  }, [meetup]);

  const allSidebarItems: SidebarItem[] = [
    {
      name: 'Home',
      value: 'home',
      icon: FiHome,
      url: `/meetup/${meetupId}/manage`,
    },
    {
      name: 'Check-in',
      value: 'checkin',
      icon: IoTicketOutline,
      url: `/meetup/${meetupId}/manage/checkin`,
    },
    {
      name: 'Raffle',
      value: 'raffle',
      icon: FiGift,
      url: `/meetup/${meetupId}/manage/raffle`,
    },
    {
      name: 'Attendees',
      value: 'attendees',
      icon: FiUsers,
      url: `/meetup/${meetupId}/manage/attendees`,
    },
    {
      name: 'Display',
      value: 'display',
      icon: FiMonitor,
      url: `/meetup/${meetupId}/manage/display`,
    },
    {
      name: 'Meetup Settings',
      value: 'settings',
      icon: FiSettings,
      url: `/meetup/${meetupId}/manage/settings`,
    },
  ];

  // Archives are historical records: the only applicable management surface is
  // settings, so hide check-in, raffle, attendees, and display for them.
  const sidebarItems = isArchive
    ? allSidebarItems.filter((item) => item.value === 'settings')
    : allSidebarItems;

  const getSidebarValueFromPath = (): string => {
    return (
      sidebarItems.find((item) => item.url === location.pathname)?.value ??
      sidebarItems[0]?.value ??
      ''
    );
  };

  const [sidebarValue, setSidebarValue] = useState<string>(
    getSidebarValueFromPath()
  );

  useEffect(() => {
    setSidebarValue(getSidebarValueFromPath());
  }, [location]);

  // Archives only expose settings, so send any other manage sub-route (e.g. the
  // dashboard's link to the home page) straight to settings.
  useEffect(() => {
    if (!isArchive || meetupId == null) return;
    const settingsUrl = `/meetup/${meetupId}/manage/settings`;
    if (location.pathname !== settingsUrl) {
      void navigate(settingsUrl, { replace: true });
    }
  }, [isArchive, meetupId, location.pathname, navigate]);

  return (
    <Page
      sidebarItems={sidebarItems}
      sidebarValue={sidebarValue}
      setSidebarValue={setSidebarValue}
      sidebarBackTo={{ label: 'Organizer Dashboard', url: '/organizer' }}
    >
      <div className="flex h-full flex-col">
        <h1 className="mt-4 line-clamp-2 w-full shrink-0 px-6 text-center text-3xl font-bold">
          {meetup?.name}
        </h1>
        <div className="grow">{children}</div>
      </div>
    </Page>
  );
};

export default ManageMeetupPage;
