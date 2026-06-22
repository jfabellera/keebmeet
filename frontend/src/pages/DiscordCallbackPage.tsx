import { Loader2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Page from '../components/Page/Page';
import { discordLogin } from '../store/authSlice';
import { useAppDispatch } from '../store/hooks';

const DiscordCallbackPage = (): ReactNode => {
  const [params] = useSearchParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isMount = useRef(false);

  useEffect(() => {
    if (isMount.current) {
      void (async () => {
        const code = params.get('code');

        if (code == null) {
          toast.error('Error', { description: 'Discord sign in was cancelled.' });
          void navigate('/login');
          return;
        }

        const action = await dispatch(discordLogin(code));

        if (discordLogin.fulfilled.match(action)) {
          const payload = action.payload;
          // An account with this email already exists; ask the user to confirm
          // and sign in before linking.
          if (payload != null && 'requiresLink' in payload) {
            void navigate('/auth/discord/link', {
              state: {
                email: payload.email,
                linkToken: payload.linkToken,
              },
            });
            return;
          }
          void navigate('/');
        } else {
          toast.error('Error', {
            description: 'Unable to sign in with Discord.',
          });
          void navigate('/login');
        }
      })();
    }
    return () => {
      isMount.current = true;
    };
  }, []);

  return (
    <Page>
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="size-10 animate-spin" />
        <p className="mt-4">Signing in with Discord...</p>
      </div>
    </Page>
  );
};

export default DiscordCallbackPage;
