import { Loader2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Page from '../components/Page/Page';
import { discordLogin, linkDiscord } from '../store/authSlice';
import { useAppDispatch } from '../store/hooks';
import { userSlice } from '../store/userSlice';

const DiscordCallbackPage = (): ReactNode => {
  const [params] = useSearchParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isMount = useRef(false);

  // `state=link` means a logged-in user is linking Discord from their account
  // page, rather than signing in.
  const isLinking = params.get('state') === 'link';

  useEffect(() => {
    if (isMount.current) return;
    isMount.current = true;

    void (async () => {
      const code = params.get('code');

      if (code == null) {
        toast.error('Error', {
          description: isLinking
            ? 'Discord linking was cancelled.'
            : 'Discord sign in was cancelled.',
        });
        void navigate(isLinking ? '/account' : '/login');
        return;
      }

      // Linking flow: attach Discord to the already-authenticated account.
      if (isLinking) {
        const action = await dispatch(linkDiscord(code));

        if (linkDiscord.fulfilled.match(action)) {
          dispatch(userSlice.util.invalidateTags(['User']));
          toast.success('Success', {
            description: 'Your Discord account has been linked.',
          });
        } else {
          toast.error('Error', {
            description: 'Unable to link your Discord account.',
          });
        }
        void navigate('/account');
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
  }, []);

  return (
    <Page>
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="size-10 animate-spin" />
        <p className="mt-4">
          {isLinking
            ? 'Linking your Discord account...'
            : 'Signing in with Discord...'}
        </p>
      </div>
    </Page>
  );
};

export default DiscordCallbackPage;
