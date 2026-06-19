import { Flex, Spinner, Text, useToast } from '@chakra-ui/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Page from '../components/Page/Page';
import { useAuthorizeEventbriteMutation } from '../store/userSlice';

const AuthorizeEventbritePage = (): ReactNode => {
  const [params] = useSearchParams();
  const [authorizeEventbrite, { isLoading }] = useAuthorizeEventbriteMutation();
  const navigate = useNavigate();
  const toast = useToast();
  const isMount = useRef(false);

  useEffect(() => {
    if (isMount.current) {
      void (async () => {
        const accessCode = params.get('code');
        try {
          if (accessCode != null)
            await authorizeEventbrite(accessCode).unwrap();
          toast({
            title: 'Success',
            description: 'Eventbrite account successfully linked.',
            status: 'success',
          });
        } catch (error: any) {
          toast({
            title: 'Error',
            description: 'Unable to authorize Eventbrite account.',
            status: 'error',
          });
        }

        navigate('/account');
      })();
    }
    return () => {
      isMount.current = true;
    };
  }, []);

  return (
    <Page>
      <Flex
        height={'100%'}
        justifyContent={'center'}
        align={'center'}
        direction={'column'}
      >
        {isLoading ? (
          <>
            <Spinner size={'xl'} />
            <Text marginTop={'1rem'}>Redirecting...</Text>
          </>
        ) : null}
      </Flex>
    </Page>
  );
};

export default AuthorizeEventbritePage;
