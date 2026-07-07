import { DeleteMeetupCard } from '@/components/Meetups/DeleteMeetupCard';
import { MeetupDiscordCard } from '@/components/Meetups/MeetupDiscordCard';
import { Spinner } from '@/components/ui/spinner';
import { useAppSelector } from '@/store/hooks';
import { useGetMeetupQuery } from '@/store/meetupSlice';
import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import MeetupDetailsSettingsCard from '../components/Meetups/MeetupDetailsSettingsCard';

const ManageMeetupSettingsPage = (): ReactNode => {
  const { meetupId } = useParams();
  const { data: meetup, isLoading } = useGetMeetupQuery(meetupId ?? '');
  const currentUserId = useAppSelector((state) => state.user.user?.id);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <MeetupDetailsSettingsCard meetupId={meetupId ?? ''} />
      <MeetupDiscordCard meetupId={meetupId ?? ''} />
      {meetup?.lead_organizer?.id === currentUserId && (
        <DeleteMeetupCard meetupId={meetupId ?? ''} />
      )}
    </div>
  );
};

export default ManageMeetupSettingsPage;
