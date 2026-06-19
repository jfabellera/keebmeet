import { type ReactNode } from 'react';
import { Button, Container, Heading, Link, VStack } from '@chakra-ui/react';
import Page from '../components/Page/Page';
import config from '../config';
import { useAppSelector } from '../store/hooks';
import { useGetUserQuery } from '../store/userSlice';

const AccountPage = (): ReactNode => {
  const { user: localUser } = useAppSelector((state) => state.user);
  const { data: user } = useGetUserQuery(localUser?.id ?? NaN, {
    skip: localUser == null,
  });

  return (
    <Page>
      <VStack spacing={'4'} marginX={'0.5rem'} marginY={'1rem'}>
        <Heading textAlign={'center'}>Account</Heading>
        <Container padding={'1rem'} background={'white'} borderRadius={'md'}>
          <Link
            href={`${config.apiUrl}/oauth2/eventbrite?redirect_uri=${config.appUrl}/account/authorize-eventbrite`}
          >
            <Button isDisabled={user?.is_eventbrite_linked}>
              {user?.is_eventbrite_linked ?? false
                ? 'Eventbrite linked!'
                : 'Link Eventbrite'}
            </Button>
          </Link>
        </Container>
      </VStack>
    </Page>
  );
};

export default AccountPage;
