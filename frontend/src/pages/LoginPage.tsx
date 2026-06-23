import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { DiscordLoginButton } from '../components/Auth/DiscordLoginButton';
import { Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Page from '../components/Page/Page';
import {
  login,
  resendVerification,
  type LoginPayload,
} from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const LoginPage = (): ReactNode => {
  const [loginPayload, setLoginPayload] = useState<LoginPayload>({
    email: '',
    password: '',
  });
  const [loginFailed, setLoginFailed] = useState<boolean>(false);
  // The Discord flows redirect here with an unverified account id so the user
  // can request a fresh verification email.
  const location = useLocation();
  const navState = location.state as { unverifiedUserId?: number } | null;
  const [unverifiedUserId, setUnverifiedUserId] = useState<number | null>(
    navState?.unverifiedUserId ?? null
  );
  const [resending, setResending] = useState<boolean>(false);
  const { loading } = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  /**
   * Handle form input changes. This updates the login payload to be dispatched.
   *
   * @param event
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setLoginPayload({
      ...loginPayload,
      [event.target.name]: event.target.value,
    });
  };

  /**
   * Handle form submit. This dispatches the login action using the login
   * payload.
   *
   * @param event
   */
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    dispatch(login(loginPayload))
      .then((action) => {
        // Get status of login
        if (login.fulfilled.match(action)) {
          // Successfully logged in, redirect user to homepage
          void navigate('/');
        } else if (login.rejected.match(action)) {
          const payload = action.payload;
          // Credentials were valid but the email isn't verified yet.
          if (
            typeof payload === 'object' &&
            payload != null &&
            'unverified' in payload
          ) {
            setUnverifiedUserId(payload.userId);
            setLoginFailed(false);
          } else {
            // Failed to login, show an error message
            setLoginFailed(true);
            setUnverifiedUserId(null);
          }
        }
      })
      .catch(() => {});
  };

  /** Requests a fresh verification email for the unverified account. */
  const handleResend = async (): Promise<void> => {
    if (unverifiedUserId == null) return;

    setResending(true);
    const action = await dispatch(resendVerification(unverifiedUserId));
    setResending(false);

    if (resendVerification.fulfilled.match(action)) {
      toast.success('Email sent', {
        description: 'Check your inbox for a new verification link.',
      });
    } else {
      toast.error('Error', {
        description: 'Could not send a new verification email.',
      });
    }
  };

  return (
    <Page>
      <div className="flex items-center justify-center p-4">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
          <div className="flex flex-col items-center">
            <h1 className="text-4xl font-bold">Sign in</h1>
          </div>
          <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    onChange={handleChange}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    name="password"
                    onChange={handleChange}
                  />
                </Field>
                {unverifiedUserId != null ? (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <p className="text-destructive text-sm">
                      Please verify your email before signing in.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={resending}
                      onClick={() => void handleResend()}
                    >
                      {resending ? <Loader2 className="animate-spin" /> : null}
                      Resend verification email
                    </Button>
                  </div>
                ) : loginFailed ? (
                  <p className="text-destructive text-center text-sm">
                    Invalid email or password
                  </p>
                ) : null}
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : null}
                  Sign in
                </Button>
                <DiscordLoginButton />
              </div>
            </form>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default LoginPage;
