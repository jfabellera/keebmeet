import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Page from '../components/Page/Page';
import { discordLink, discordRegister } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

interface DiscordLinkState {
  email: string;
  linkToken: string;
}

type Mode = 'choose' | 'link' | 'create';

/**
 * Reached from {@link DiscordCallbackPage} when a Discord login's email already
 * belongs to an existing MMS account. The user chooses to either link Discord to
 * that account (confirm + sign in) or create a new, separate account under a
 * different email.
 */
const DiscordLinkPage = (): ReactNode => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.user);

  const state = location.state as DiscordLinkState | null;
  const [mode, setMode] = useState<Mode>('choose');
  const [password, setPassword] = useState<string>('');
  const [linkFailed, setLinkFailed] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [createError, setCreateError] = useState<string | null>(null);

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

  const handleCreate = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setCreateError(null);

    dispatch(
      discordRegister({
        email: newEmail,
        linkToken: state.linkToken,
      })
    )
      .then((action) => {
        if (discordRegister.fulfilled.match(action)) {
          toast.success('Success', {
            description: 'Your account has been created.',
          });
          void navigate('/');
        } else {
          setCreateError(
            action.payload === 409
              ? 'That email is already in use. Try another.'
              : 'Unable to create account. Please try again.'
          );
        }
      })
      .catch(() => {});
  };

  return (
    <Page>
      <div className="flex items-center justify-center p-4">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-bold">
              {mode === 'create' ? 'Create account' : 'Link Discord account'}
            </h1>
          </div>
          <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
            {mode === 'choose' ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm">
                  An account already exists for{' '}
                  <span className="font-semibold">{state.email}</span>. You can
                  link your Discord account to it, or create a new account with a
                  different email.
                </p>
                <Button
                  onClick={() => {
                    setMode('link');
                  }}
                >
                  Link to existing account
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMode('create');
                  }}
                >
                  Create a new account
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigate('/login');
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : mode === 'link' ? (
              <form onSubmit={handleLink}>
                <div className="flex flex-col gap-4">
                  <p className="text-sm">
                    Sign in to confirm linking Discord to your account.
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
                    {loading ? <Loader2 className="animate-spin" /> : null}
                    Link and sign in
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMode('choose');
                    }}
                  >
                    Back
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="flex flex-col gap-4">
                  <p className="text-sm">
                    Enter a different email address to create a new, separate
                    account.
                  </p>
                  <div className="grid gap-1.5">
                    <Label htmlFor="newEmail">Email</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      name="newEmail"
                      value={newEmail}
                      onChange={(event) => {
                        setNewEmail(event.target.value);
                      }}
                    />
                  </div>
                  {createError != null ? (
                    <p className="text-destructive text-center text-sm">
                      {createError}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : null}
                    Create account
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMode('choose');
                    }}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
};

export default DiscordLinkPage;
