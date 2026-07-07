import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Page from '../components/Page/Page';
import { discordLink } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

interface DiscordLinkState {
  email: string;
  linkToken: string;
}

/**
 * Reached from {@link DiscordCallbackPage} when a Discord login's email already
 * belongs to an existing KeebMeet account. The user confirms by signing in, which
 * links Discord to that account.
 */
const DiscordLinkPage = (): ReactNode => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.user);

  const state = location.state as DiscordLinkState | null;
  const [password, setPassword] = useState<string>('');
  const [linkFailed, setLinkFailed] = useState<boolean>(false);

  // No link context (e.g. direct navigation or a refresh): start over.
  useEffect(() => {
    if (state?.email == null || state?.linkToken == null) {
      void navigate('/login', { replace: true });
    }
  }, [state, navigate]);

  if (state?.email == null || state?.linkToken == null) {
    return null;
  }

  const handleLink = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setLinkFailed(false);

    dispatch(
      discordLink({
        email: state.email,
        password,
        linkToken: state.linkToken,
      })
    )
      .then((action) => {
        if (discordLink.fulfilled.match(action)) {
          toast.success('Success', {
            description: 'Your Discord account has been linked.',
          });
          void navigate('/');
        } else {
          setLinkFailed(true);
        }
      })
      .catch(() => {});
  };

  return (
    <Page>
      <div className="flex items-center justify-center p-4">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-bold">Link Discord account</h1>
          </div>
          <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
            <form onSubmit={handleLink}>
              <div className="flex flex-col gap-4">
                <p className="text-sm">
                  An account already exists for{' '}
                  <span className="font-semibold">{state.email}</span>. Sign in
                  to link your Discord account to it.
                </p>
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    value={state.email}
                    readOnly
                    disabled
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    name="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                    }}
                  />
                </div>
                {linkFailed ? (
                  <p className="text-destructive text-center text-sm">
                    Unable to link account. Check your password and try again.
                  </p>
                ) : null}
                <Button type="submit" disabled={loading}>
                  Link and sign in
                  {loading ? <Loader2 className="animate-spin" /> : null}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void navigate('/login');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default DiscordLinkPage;
