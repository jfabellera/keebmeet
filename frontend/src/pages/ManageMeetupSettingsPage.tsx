import { DeleteMeetupCard } from '@/components/Meetups/DeleteMeetupCard';
import { MeetupDiscordCard } from '@/components/Meetups/MeetupDiscordCard';
import { useAppSelector } from '@/store/hooks';
import { useGetMeetupQuery } from '@/store/meetupSlice';
import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import MeetupDetailsSettingsCard from '../components/Meetups/MeetupDetailsSettingsCard';
import MeetupDisplaySettingsCard from '../components/Meetups/MeetupDisplaySettingsCard';

const ManageMeetupSettingsPage = (): ReactNode => {
  const { meetupId } = useParams();
  const { data: meetup } = useGetMeetupQuery(meetupId ?? '');
  const currentUserId = useAppSelector((state) => state.user.user?.id);

  return (
    <div className="flex flex-col gap-4 p-4">
      <MeetupDetailsSettingsCard meetupId={meetupId ?? ''} />
      <MeetupDiscordCard meetupId={meetupId ?? ''} />
      <MeetupDisplaySettingsCard meetupId={meetupId ?? ''} />
      {meetup?.lead_organizer?.id === currentUserId && (
        <DeleteMeetupCard meetupId={meetupId ?? ''} />
      )}
    </div>
  );
};

export default ManageMeetupSettingsPage;
