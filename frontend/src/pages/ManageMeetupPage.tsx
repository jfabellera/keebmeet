import { useEffect, useState, type ReactNode } from 'react';
import { FiGift, FiHome, FiMonitor, FiSettings, FiUsers } from 'react-icons/fi';
import { IoTicketOutline } from 'react-icons/io5';
import { useLocation, useParams } from 'react-router-dom';
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

  /**
   * Subscribe user to updates for the selected meetup. This will invalidate the
   * cache for the fetched meetup and attendees whenever a meetup is updated.
   */
  useEffect(() => {
    const onMeetupUpdate = (meetupId: string): void => {
      console.log(meetupId);
      dispatch(
        meetupSlice.util.invalidateTags([{ type: 'Meetup', id: meetupId }])
      );
      dispatch(
        organizerSlice.util.invalidateTags([
          { type: 'Attendees', id: meetupId },
        ])
      );
      dispatch(
        organizerSlice.util.invalidateTags([
          'Raffle',
          { type: 'Raffles', id: meetupId },
        ])
      );
    };

    socket.emit('meetup:subscribe', { meetupId });

    socket.on('meetup:update', (payload) => {
      onMeetupUpdate(payload.id);
    });

    // Resubscribe and force update on reconnection after losing connection
    socket.on('connect', () => {
      socket.emit('meetup:subscribe', { meetupId });
      onMeetupUpdate(meetupId ?? '');
    });

    // Stay subscribed to updates in case user comes back to page
  }, []);

  const sidebarItems: SidebarItem[] = [
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
      name: 'Display',
      value: 'display',
      icon: FiMonitor,
      url: `/meetup/${meetupId}/manage/display`,
    },
    {
      name: 'Attendees',
      value: 'attendees',
      icon: FiUsers,
      url: `/meetup/${meetupId}/manage/attendees`,
    },
    {
      name: 'Meetup Settings',
      value: 'settings',
      icon: FiSettings,
      url: `/meetup/${meetupId}/manage/settings`,
    },
  ];

  const getSidebarValueFromPath = (): string => {
    return sidebarItems.filter((item) => item.url === location.pathname)[0]
      .value;
  };

  const [sidebarValue, setSidebarValue] = useState<string>(
    getSidebarValueFromPath()
  );

  useEffect(() => {
    setSidebarValue(getSidebarValueFromPath());
  }, [location]);

  return (
    <Page
      sidebarItems={sidebarItems}
      sidebarValue={sidebarValue}
      setSidebarValue={setSidebarValue}
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
