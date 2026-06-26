import { useAppSelector } from '@/store/hooks';
import { useGetUserQuery } from '@/store/userSlice';
import { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import DiscordLinkButton from '../Auth/DiscordLinkButton';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export const MeetupDiscordCard = (): ReactNode => {
  const { user: localUser, loading } = useAppSelector((state) => state.user);
  const { data: user, refetch } = useGetUserQuery(localUser?.id ?? NaN, {
    skip: localUser == null,
  });
  return (
    <Card className="gap-1 p-4">
      <h2 className="text-2xl font-semibold">Discord</h2>
      {user?.is_discord_linked ? (
        // Allow user to setup a discord event
        <p>No discord events available.</p>
      ) : (
        <div>
          {/* Prompt user to connect their discord account */}
          <p>
            Please connect your Discord account in your{' '}
            <Link to="/account" className="text-primary underline">
              account settings
            </Link>
            .
          </p>
        </div>
      )}
    </Card>
  );
};
