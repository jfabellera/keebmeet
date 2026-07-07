import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useFormik } from 'formik';
import { Loader2 } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as Yup from 'yup';
import { DiscordLoginButton } from '../components/Auth/DiscordLoginButton';
import Page from '../components/Page/Page';
import ImageUploadField from '../components/shared/ImageUploadField';
import { useUserPhotoUpload } from '../hooks/useUserPhotoUpload';
import { register } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const RegisterSchema = Yup.object().shape({
  // Because Yup.string().email() sucks
  email: Yup.string()
    .matches(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Invalid email'
    )
    .required('Required'),
  firstName: Yup.string().required('Required'),
  lastName: Yup.string().required('Required'),
  nickName: Yup.string().required('Required'),
  password: Yup.string()
    .required('Required')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/,
      'Must contain 8 characters, one uppercase, one lowercase, one number, and one special character'
    ),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Required'),
  turnstileToken: Yup.string().required('Captcha verification is required'),
});

const RegisterPage = (): ReactNode => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.user);
  const navigate = useNavigate();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const formik = useFormik({
    initialValues: {
      email: '',
      firstName: '',
      lastName: '',
      nickName: '',
      password: '',
      confirmPassword: '',
      requestOrganizer: false,
      turnstileToken: '',
      // profilePhotoUrl is the preview; profilePhotoKey is submitted.
      profilePhotoKey: '',
      profilePhotoUrl: '',
    },
    onSubmit: (values) => {
      dispatch(register(values))
        .then((action) => {
          // Get status of register
          if (register.fulfilled.match(action)) {
            // Successfully registered, prompt the user to verify their email.
            toast.success('Account created', {
              description:
                'Check your email for a link to verify your account.',
            });
            void navigate('/login');
          } else if (register.rejected.match(action)) {
            // Failed to register, show an error message
            // TODO(jan)
            // Turnstile tokens are single-use, so reset the widget to let the
            // user try again with a fresh one.
            turnstileRef.current?.reset();
            void formik.setFieldValue('turnstileToken', '');
          }
        })
        .catch(() => {});
    },
    validationSchema: RegisterSchema,
    validateOnMount: true,
  });

  return (
    <Page>
      <div className="flex items-center justify-center p-4">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
          <div className="flex flex-col items-center">
            <h1 className="text-center text-4xl font-bold">Sign up</h1>
          </div>
          <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="flex flex-col gap-4">
                <div className="flex justify-center">
                  <ImageUploadField
                    className="w-40"
                    label="Profile Photo (optional)"
                    aspectRatio={1}
                    rounded
                    useUpload={useUserPhotoUpload}
                    previewUrl={formik.values.profilePhotoUrl}
                    onUploaded={(imageKey, imageUrl) => {
                      void formik.setFieldValue('profilePhotoKey', imageKey);
                      void formik.setFieldValue('profilePhotoUrl', imageUrl);
                    }}
                    onRemove={() => {
                      void formik.setFieldValue('profilePhotoKey', '');
                      void formik.setFieldValue('profilePhotoUrl', '');
                    }}
                  />
                </div>
                <div className="flex flex-row gap-2">
                  <FormField
                    formik={formik}
                    name="firstName"
                    label="First Name"
                    className="flex-1"
                  />
                  <FormField
                    formik={formik}
                    name="lastName"
                    label="Last Name"
                    className="flex-1"
                  />
                </div>
                <FormField
                  formik={formik}
                  name="nickName"
                  label="Display Name"
                />
                <FormField
                  formik={formik}
                  name="email"
                  label="Email address"
                  type="email"
                  invalid={
                    error === 409 ||
                    (formik.errors.email != null && formik.touched.email)
                  }
                  message={
                    error === 409 ? 'Email is already in use' : undefined
                  }
                />
                <FormField
                  formik={formik}
                  name="password"
                  label="Password"
                  type="password"
                />
                <FormField
                  formik={formik}
                  name="confirmPassword"
                  label="Confirm Password"
                  type="password"
                />
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Label htmlFor="requestOrganizer" className="pr-4">
                    Are you an organizer?
                  </Label>
                  <Checkbox
                    id="requestOrganizer"
                    checked={formik.values.requestOrganizer}
                    onCheckedChange={(checked) =>
                      formik.setFieldValue('requestOrganizer', checked === true)
                    }
                  />
                  <span>Yes</span>
                </div>
                <div className="flex items-center justify-center pt-2">
                  <Turnstile
                    ref={turnstileRef}
                    siteKey="0x4AAAAAADvKnjEaFlmjd5Yq"
                    onSuccess={(token) => {
                      void formik.setFieldValue('turnstileToken', token);
                    }}
                    onExpire={() => {
                      void formik.setFieldValue('turnstileToken', '');
                    }}
                    onError={() => {
                      void formik.setFieldValue('turnstileToken', '');
                    }}
                  />
                </div>
                <div className="flex flex-col gap-10 pt-2">
                  <Button
                    type="submit"
                    disabled={loading || !formik.isValid}
                    size="lg"
                  >
                    Sign up
                    {loading ? <Loader2 className="animate-spin" /> : null}
                  </Button>
                  <DiscordLoginButton />
                </div>
                {error != null ? (
                  <p className="text-destructive text-center text-sm">
                    Registration failed
                  </p>
                ) : null}
                <div className="pt-2">
                  <p className="text-center">
                    Already a user?{' '}
                    <span
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer text-blue-500"
                      onClick={() => {
                        void navigate('/login');
                      }}
                    >
                      Login
                    </span>
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default RegisterPage;
