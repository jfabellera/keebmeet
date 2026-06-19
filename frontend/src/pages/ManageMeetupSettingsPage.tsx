import { type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import MeetupDetailsSettingsCard from '../components/Meetups/MeetupDetailsSettingsCard';
import MeetupDisplaySettingsCard from '../components/Meetups/MeetupDisplaySettingsCard';

const ManageMeetupSettingsPage = (): ReactNode => {
  const { meetupId } = useParams();

  return (
    <>
      <MeetupDetailsSettingsCard meetupId={Number(meetupId)} />
      <MeetupDisplaySettingsCard meetupId={Number(meetupId)} />
    </>
  );
};

export default ManageMeetupSettingsPage;
