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
  const { data: meetup } = useGetMeetupQuery(Number(meetupId));
  const currentUserId = useAppSelector((state) => state.user.user?.id);

  return (
    <div className="flex flex-col gap-4 p-4">
      <MeetupDetailsSettingsCard meetupId={Number(meetupId)} />
      <MeetupDiscordCard meetupId={Number(meetupId)} />
      <MeetupDisplaySettingsCard meetupId={Number(meetupId)} />
      {meetup?.lead_organizer?.id === currentUserId && (
        <DeleteMeetupCard meetupId={Number(meetupId)} />
      )}
    </div>
  );
};

export default ManageMeetupSettingsPage;
