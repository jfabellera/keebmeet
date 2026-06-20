import { type ReactNode } from 'react';
import Page from '../components/Page/Page';
import config from '../config';
import { useAppSelector } from '../store/hooks';
import { useGetUserQuery } from '../store/userSlice';
import { Button } from '@/components/ui/button';

const AccountPage = (): ReactNode => {
  const { user: localUser } = useAppSelector((state) => state.user);
  const { data: user } = useGetUserQuery(localUser?.id ?? NaN, {
    skip: localUser == null,
  });

  return (
    <Page>
      <div className="mx-2 my-4 flex flex-col items-center gap-4">
        <h1 className="text-center text-2xl font-bold">Account</h1>
        <div className="w-full max-w-2xl rounded-md bg-card p-4 text-card-foreground">
          <a
            href={`${config.apiUrl}/oauth2/eventbrite?redirect_uri=${config.appUrl}/account/authorize-eventbrite`}
          >
            <Button disabled={user?.is_eventbrite_linked}>
              {(user?.is_eventbrite_linked ?? false)
                ? 'Eventbrite linked!'
                : 'Link Eventbrite'}
            </Button>
          </a>
        </div>
      </div>
    </Page>
  );
};

export default AccountPage;
