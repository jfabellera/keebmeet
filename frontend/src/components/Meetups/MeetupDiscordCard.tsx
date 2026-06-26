import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppSelector } from '@/store/hooks';
import {
  useCreateMeetupDiscordMessageMutation,
  useDeleteMeetupDiscordMessageMutation,
  useGetMeetupDiscordMessageQuery,
  useUpdateMeetupDiscordMessageMutation,
} from '@/store/meetupSlice';
import {
  useGetUserDiscordServerChannelsQuery,
  useGetUserDiscordServersQuery,
  useGetUserQuery,
} from '@/store/userSlice';
import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface Props {
  meetupId: number;
}

// Surfaces an RTK Query mutation error as a toast; returns true when errored.
const handleMutationError = (
  result: { error?: unknown },
  fallback: string
): boolean => {
  if ('error' in result && result.error != null) {
    const error = result.error as { data?: { message?: string } };
    toast.error(fallback, { description: error.data?.message });
    return true;
  }
  return false;
};

export const MeetupDiscordCard = ({ meetupId }: Props): ReactNode => {
  const { user: localUser } = useAppSelector((state) => state.user);
  const { data: user } = useGetUserQuery(localUser?.id ?? NaN, {
    skip: localUser == null,
  });

  const isLinked = user?.is_discord_linked === true;

  const { data: servers } = useGetUserDiscordServersQuery(
    localUser?.id ?? NaN,
    { skip: localUser == null || !isLinked }
  );
  const { data: message, isLoading: isLoadingMessage } =
    useGetMeetupDiscordMessageQuery(meetupId, {
      skip: localUser == null || !isLinked,
    });

  const [selectedServer, setSelectedServer] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');

  const { data: channels } = useGetUserDiscordServerChannelsQuery(
    { userId: localUser?.id ?? NaN, serverId: selectedServer },
    { skip: localUser == null || selectedServer === '' }
  );

  const [createMessage, { isLoading: isCreating }] =
    useCreateMeetupDiscordMessageMutation();
  const [updateMessage, { isLoading: isUpdating }] =
    useUpdateMeetupDiscordMessageMutation();
  const [deleteMessage, { isLoading: isDeleting }] =
    useDeleteMeetupDiscordMessageMutation();

  const onCreate = async (): Promise<void> => {
    const result = await createMessage({
      meetupId,
      server_id: selectedServer,
      channel_id: selectedChannel,
    });
    if (handleMutationError(result, 'Failed to create Discord message')) return;
    toast.success('Discord message created.');
    setSelectedServer('');
    setSelectedChannel('');
  };

  const onUpdate = async (): Promise<void> => {
    const result = await updateMessage(meetupId);
    if (handleMutationError(result, 'Failed to update Discord message')) return;
    toast.success('Discord message updated.');
  };

  const onDelete = async (): Promise<void> => {
    const result = await deleteMessage(meetupId);
    if (handleMutationError(result, 'Failed to delete Discord message')) return;
    toast.success('Discord message deleted.');
  };

  return (
    <Card className="gap-2 p-4">
      <h2 className="text-2xl font-semibold">Discord</h2>

      {!isLinked ? (
        <p>
          Please connect your Discord account in your{' '}
          <Link to="/account" className="text-primary underline">
            account settings
          </Link>
          .
        </p>
      ) : isLoadingMessage ? (
        <p>Loading...</p>
      ) : message != null ? (
        <div className="flex flex-col gap-2">
          <p>
            An announcement is posted in{' '}
            <span className="font-medium">
              {servers?.find((server) => server.id === message.guild_id)?.name ??
                'a server'}
            </span>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <a
                href={`https://discord.com/channels/${message.guild_id}/${message.channel_id}/${message.message_id}`}
                target="_blank"
                rel="noreferrer"
              >
                View in Discord
              </a>
            </Button>
            <Button
              onClick={() => {
                void onUpdate();
              }}
              disabled={isUpdating}
            >
              Update
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void onDelete();
              }}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p>Post an announcement for this meetup to a Discord channel.</p>
          <Field>
            <FieldLabel htmlFor="discord-server">Server</FieldLabel>
            <Select
              value={selectedServer}
              onValueChange={(value) => {
                setSelectedServer(value);
                setSelectedChannel('');
              }}
            >
              <SelectTrigger id="discord-server" className="w-full">
                <SelectValue placeholder="Select a server" />
              </SelectTrigger>
              <SelectContent>
                {servers?.map((server) => (
                  <SelectItem key={server.id} value={server.id}>
                    {server.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="discord-channel">Channel</FieldLabel>
            <Select
              value={selectedChannel}
              onValueChange={setSelectedChannel}
              disabled={selectedServer === ''}
            >
              <SelectTrigger id="discord-channel" className="w-full">
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                {channels?.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            className="self-start"
            onClick={() => {
              void onCreate();
            }}
            disabled={
              selectedServer === '' || selectedChannel === '' || isCreating
            }
          >
            Create
          </Button>
        </div>
      )}
    </Card>
  );
};
