import { Loader2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Page from '../components/Page/Page';
import { useAuthorizeEventbriteMutation } from '../store/userSlice';

const AuthorizeEventbritePage = (): ReactNode => {
  const [params] = useSearchParams();
  const [authorizeEventbrite, { isLoading }] = useAuthorizeEventbriteMutation();
  const navigate = useNavigate();
  const isMount = useRef(false);

  useEffect(() => {
    if (isMount.current) {
      void (async () => {
        const accessCode = params.get('code');
        try {
          if (accessCode != null)
            await authorizeEventbrite(accessCode).unwrap();
          toast.success('Success', {
            description: 'Eventbrite account successfully linked.',
          });
        } catch (error: any) {
          toast.error('Error', {
            description: 'Unable to authorize Eventbrite account.',
          });
        }

        void navigate('/account');
      })();
    }
    return () => {
      isMount.current = true;
    };
  }, []);

  return (
    <Page>
      <div className="flex h-full flex-col items-center justify-center">
        {isLoading ? (
          <>
            <Loader2 className="size-10 animate-spin" />
            <p className="mt-4">Redirecting...</p>
          </>
        ) : null}
      </div>
    </Page>
  );
};

export default AuthorizeEventbritePage;
