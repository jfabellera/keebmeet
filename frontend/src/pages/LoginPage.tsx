import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../components/Page/Page';
import { login, type LoginPayload } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const LoginPage = (): ReactNode => {
  const [loginPayload, setLoginPayload] = useState<LoginPayload>({
    email: '',
    password: '',
  });
  const [loginFailed, setLoginFailed] = useState<boolean>(false);
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
          // Failed to login, show an error message
          setLoginFailed(true);
        }
      })
      .catch(() => {});
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
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    onChange={handleChange}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    name="password"
                    onChange={handleChange}
                  />
                </div>
                {loginFailed ? (
                  <p className="text-destructive text-center text-sm">
                    Invalid email or password
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-500 text-white hover:bg-blue-600"
                >
                  {loading ? <Loader2 className="animate-spin" /> : null}
                  Sign in
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default LoginPage;
