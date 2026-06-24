import { Button } from '@/components/ui/button';
import { jwtDecode } from 'jwt-decode';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Page from '../components/Page/Page';
import { resendVerification, verifyEmail } from '../store/authSlice';
import { useAppDispatch } from '../store/hooks';

type Status = 'verifying' | 'success' | 'error';

/** Reads the user id embedded in a verification token, or null if unreadable. */
const userIdFromToken = (token: string | null): number | null => {
  if (token == null) return null;
  try {
    return jwtDecode<{ user_id: number }>(token).user_id;
  } catch {
    return null;
  }
};

const VerifyEmailPage = (): ReactNode => {
  const [params] = useSearchParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const hasRun = useRef(false);

  const [status, setStatus] = useState<Status>('verifying');
  const [resending, setResending] = useState(false);

  const token = params.get('token');
  const userId = userIdFromToken(token);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    void (async () => {
      if (token == null) {
        setStatus('error');
        return;
      }

      const action = await dispatch(verifyEmail(token));
      setStatus(verifyEmail.fulfilled.match(action) ? 'success' : 'error');
    })();
  }, []);

  const handleResend = async (): Promise<void> => {
    if (userId == null) return;

    setResending(true);
    const action = await dispatch(resendVerification(userId));
    setResending(false);

    if (resendVerification.fulfilled.match(action)) {
      toast.success('Email sent', {
        description: 'Check your inbox for a new verification link.',
      });
    } else if (action.payload === 429) {
      toast.error('Too many requests', {
        description:
          'You have requested too many verification emails. Please wait a few minutes and try again.',
      });
    } else {
      toast.error('Error', {
        description: 'Could not send a new verification email.',
      });
    }
  };

  return (
    <Page>
      <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="size-10 animate-spin" />
            <p>Verifying your email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="size-12 text-green-600" />
            <h1 className="text-2xl font-bold">Email verified</h1>
            <p className="text-muted-foreground">
              Your email address has been verified. You can now sign in.
            </p>
            <Button size="lg" onClick={() => void navigate('/login')}>
              Continue to login
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="text-destructive size-12" />
            <h1 className="text-2xl font-bold">Verification failed</h1>
            <p className="text-muted-foreground">
              This verification link is invalid or has expired.
            </p>
            <div className="flex flex-col gap-2">
              {userId != null && (
                <Button size="lg" disabled={resending} onClick={handleResend}>
                  {resending ? <Loader2 className="animate-spin" /> : null}
                  Send a new link
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => void navigate('/login')}
              >
                Back to login
              </Button>
            </div>
          </>
        )}
      </div>
    </Page>
  );
};

export default VerifyEmailPage;
