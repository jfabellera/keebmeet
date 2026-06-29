import { DeleteMeetupCard } from '@/components/Meetups/DeleteMeetupCard';
import { MeetupDiscordCard } from '@/components/Meetups/MeetupDiscordCard';
import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import MeetupDetailsSettingsCard from '../components/Meetups/MeetupDetailsSettingsCard';
import MeetupDisplaySettingsCard from '../components/Meetups/MeetupDisplaySettingsCard';

const ManageMeetupSettingsPage = (): ReactNode => {
  const { meetupId } = useParams();

  return (
    <div className="flex flex-col gap-4 p-4">
      <MeetupDetailsSettingsCard meetupId={Number(meetupId)} />
      <MeetupDiscordCard meetupId={Number(meetupId)} />
      <MeetupDisplaySettingsCard meetupId={Number(meetupId)} />
      <DeleteMeetupCard meetupId={Number(meetupId)} />
    </div>
  );
};

export default ManageMeetupSettingsPage;
