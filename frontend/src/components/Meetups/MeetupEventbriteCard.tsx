import { Spinner } from '@/components/ui/spinner';
import { useGetMeetupQuery } from '@/store/meetupSlice';
import { useSyncEventbriteAttendeesMutation } from '@/store/organizerSlice';
import { ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface Props {
  meetupId: string;
}

export const MeetupEventbriteCard = ({ meetupId }: Props): ReactNode => {
  const { data: meetup } = useGetMeetupQuery(meetupId);
  const [syncAttendees, { isLoading: isSyncing }] =
    useSyncEventbriteAttendeesMutation();

  // Only meetups imported from Eventbrite carry an event URL; nothing to sync
  // otherwise, so the card hides itself.
  if (meetup?.eventbrite_url == null) return null;

  const onSync = async (): Promise<void> => {
    const result = await syncAttendees(meetup?.id ?? '');

    if ('error' in result && result.error != null) {
      const error = result.error as { data?: { message?: string } };
      toast.error('Failed to sync Eventbrite attendees', {
        description: error.data?.message,
      });
      return;
    }

    toast.success('Eventbrite attendees synced.');
  };

  return (
    <Card className="gap-2 p-4">
      <h2 className="text-2xl font-semibold">Eventbrite</h2>
      <p className="text-muted-foreground">
        This meetup is linked to an Eventbrite event. Attendees sync
        automatically, but you can pull the latest list manually at any time.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <a href={meetup.eventbrite_url} target="_blank" rel="noreferrer">
            View on Eventbrite
          </a>
        </Button>
        <Button
          onClick={() => {
            void onSync();
          }}
          disabled={isSyncing}
        >
          Sync attendees
          {isSyncing && <Spinner />}
        </Button>
      </div>
    </Card>
  );
};

export default MeetupEventbriteCard;
