import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useFormik } from 'formik';
import { Loader2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { FaDiscord } from 'react-icons/fa';
import { toast } from 'sonner';
import { redirectToDiscordLink } from '../util/discord';
import * as Yup from 'yup';
import Page from '../components/Page/Page';
import config from '../config';
import { updateProfile } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useGetUserQuery } from '../store/userSlice';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;

const ProfileSchema = Yup.object().shape({
  firstName: Yup.string().required('Required'),
  lastName: Yup.string().required('Required'),
  displayName: Yup.string().required('Required'),
  // Password is optional; only validated when the user types a new one.
  password: Yup.string().test(
    'password-strength',
    'Must contain 8 characters, one uppercase, one lowercase, one number, and one special character',
    (value) => value == null || value === '' || PASSWORD_REGEX.test(value)
  ),
  confirmPassword: Yup.string().test(
    'passwords-match',
    'Passwords must match',
    (value, ctx) => ((ctx.parent.password as string) ?? '') === (value ?? '')
  ),
});

const AccountPage = (): ReactNode => {
  const dispatch = useAppDispatch();
  const { user: localUser, loading } = useAppSelector((state) => state.user);
  const { data: user, refetch } = useGetUserQuery(localUser?.id ?? NaN, {
    skip: localUser == null,
  });

  const formik = useFormik({
    // Prefilled from the fetched user; reinitialised once it loads.
    initialValues: {
      email: user?.email ?? '',
      firstName: user?.first_name ?? '',
      lastName: user?.last_name ?? '',
      displayName: user?.display_name ?? '',
      password: '',
      confirmPassword: '',
    },
    enableReinitialize: true,
    validationSchema: ProfileSchema,
    onSubmit: (values) => {
      if (localUser == null) return;

      void dispatch(
        updateProfile({
          userId: localUser.id,
          firstName: values.firstName,
          lastName: values.lastName,
          displayName: values.displayName,
          password: values.password,
        })
      )
        .then((action) => {
          if (updateProfile.fulfilled.match(action)) {
            void refetch();
            // Reset to the saved values with the password fields cleared. This
            // also clears touched/errors so no stale validation messages show.
            formik.resetForm({
              values: {
                email: values.email,
                firstName: values.firstName,
                lastName: values.lastName,
                displayName: values.displayName,
                password: '',
                confirmPassword: '',
              },
            });
            toast.success('Profile updated');
          } else {
            toast.error('Failed to update profile');
          }
        })
        .catch(() => {});
    },
  });

  return (
    <Page>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
        <h1 className="text-center text-2xl font-bold">Account</h1>
        <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
          <form onSubmit={formik.handleSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <FormField
                formik={formik}
                name="email"
                label="Email address"
                type="email"
                disabled
              />
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
                name="displayName"
                label="Display Name"
              />
              <div className="border-border mt-2 border-t pt-4">
                <div className="flex flex-col gap-4">
                  <FormField
                    formik={formik}
                    name="password"
                    label="New Password"
                    type="password"
                  />
                  <FormField
                    formik={formik}
                    name="confirmPassword"
                    label="Confirm New Password"
                    type="password"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading || !formik.isValid || !formik.dirty}
                size="lg"
              >
                {loading ? <Loader2 className="animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </form>
        </div>
        <div className="bg-card text-card-foreground flex flex-col gap-4 rounded-lg p-8 shadow-lg">
          <h2 className="text-lg font-medium">Connections</h2>
          <div className="flex items-center justify-between gap-4">
            <span>Discord</span>
            {(user?.is_discord_linked ?? false) ? (
              <div className="flex items-center gap-2">
                {user?.discord_username != null ? (
                  <span className="text-foreground/70 text-sm">
                    @{user.discord_username}
                  </span>
                ) : null}
                <span className="text-sm font-medium text-green-600">
                  Linked
                </span>
              </div>
            ) : (
              <Button
                className="bg-[#5865F2] text-white hover:bg-[#4752c4]"
                onClick={redirectToDiscordLink}
              >
                <FaDiscord />
                Link Discord
              </Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Eventbrite</span>
            <a
              href={`${config.apiUrl}/oauth2/eventbrite?redirect_uri=${config.appUrl}/account/authorize-eventbrite`}
            >
              <Button disabled={user?.is_eventbrite_linked}>
                {(user?.is_eventbrite_linked ?? false)
                  ? 'Eventbrite linked!'
                  : 'Link Eventbrite'}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default AccountPage;
