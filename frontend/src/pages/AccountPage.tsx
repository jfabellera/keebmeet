import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { USERNAME_REGEX } from '@keebmeet/shared';
import { useFormik } from 'formik';
import { useState, type ReactNode } from 'react';
import { FaDiscord } from 'react-icons/fa';
import { toast } from 'sonner';
import * as Yup from 'yup';
import GroupsCard from '../components/Account/GroupsCard';
import Page from '../components/Page/Page';
import BackButton from '../components/shared/BackButton';
import ImageUploadField from '../components/shared/ImageUploadField';
import config from '../config';
import { usePendingUploads } from '../hooks/usePendingUploads';
import { updateProfile } from '../store/authSlice';
import { groupSlice } from '../store/groupSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  useCheckUsernameAvailableQuery,
  useGetUserQuery,
  useRequestOrganizerMutation,
  useUnlinkDiscordMutation,
  useUploadUserImageMutation,
} from '../store/userSlice';
import { redirectToDiscordLink } from '../util/discord';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;

const ProfileSchema = Yup.object().shape({
  firstName: Yup.string().required('Required'),
  lastName: Yup.string().required('Required'),
  displayName: Yup.string().required('Required'),
  username: Yup.string()
    .required('Required')
    .matches(
      USERNAME_REGEX,
      'Lowercase letters, numbers, and underscores only, and cannot start or end with an underscore'
    ),
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
  const { data: user, refetch } = useGetUserQuery(localUser?.id ?? '', {
    skip: localUser == null,
  });
  const [requestOrganizer, { isLoading: isRequestingOrganizer }] =
    useRequestOrganizerMutation();
  const [unlinkDiscord, { isLoading: isUnlinking }] =
    useUnlinkDiscordMutation();
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const { isUploading, onUploadingChange } = usePendingUploads();

  const onRequestOrganizer = (): void => {
    void (async () => {
      try {
        await requestOrganizer().unwrap();
        toast.success('Organizer request submitted', {
          description: 'An admin will review your request.',
        });
      } catch {
        toast.error('Could not submit your request. Please try again.');
      }
    })();
  };

  const onUnlinkDiscord = (): void => {
    if (user == null) return;
    void (async () => {
      try {
        await unlinkDiscord(user.id).unwrap();
        dispatch(groupSlice.util.invalidateTags(['MyGroups']));
        toast.success('Your Discord account has been unlinked.');
        setShowUnlinkConfirm(false);
      } catch (err) {
        const message = (err as { data?: { message?: string } }).data?.message;
        toast.error(message ?? 'Could not unlink Discord. Please try again.');
      }
    })();
  };

  const formik = useFormik({
    // Prefilled from the fetched user; reinitialised once it loads.
    initialValues: {
      email: user?.email ?? '',
      firstName: user?.first_name ?? '',
      lastName: user?.last_name ?? '',
      displayName: user?.display_name ?? '',
      username: user?.username ?? '',
      password: '',
      confirmPassword: '',
      // photoUrl is the preview; photoKey is only set on a new upload.
      photoUrl: user?.photo_url ?? '',
      photoKey: '',
    },
    enableReinitialize: true,
    validationSchema: ProfileSchema,
    onSubmit: (values) => {
      if (localUser == null) return;

      // A new upload sets photoKey; clearing an existing photo empties photoUrl;
      // otherwise leave it unchanged (undefined).
      let photoKey: string | undefined;
      if (values.photoKey !== '') {
        photoKey = values.photoKey;
      } else if (
        values.photoUrl === '' &&
        formik.initialValues.photoUrl !== ''
      ) {
        photoKey = '';
      }

      void dispatch(
        updateProfile({
          userId: localUser.id,
          firstName: values.firstName,
          lastName: values.lastName,
          displayName: values.displayName,
          username: values.username,
          password: values.password,
          photoKey,
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
                username: values.username,
                password: '',
                confirmPassword: '',
                photoUrl: values.photoUrl,
                photoKey: '',
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

  const usernameChanged =
    formik.values.username !== formik.initialValues.username;
  const usernameValid = USERNAME_REGEX.test(formik.values.username);
  const { data: usernameCheck } = useCheckUsernameAvailableQuery(
    { username: formik.values.username, excludeId: user?.id },
    { skip: !usernameChanged || !usernameValid }
  );
  const usernameTaken =
    usernameChanged && usernameValid && usernameCheck?.available === false;

  return (
    <Page>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
        <div className="relative flex items-center justify-center">
          <BackButton to="/" label="Back to home" className="absolute left-0" />
          <h1 className="text-2xl font-bold">Account</h1>
        </div>
        <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
          <form onSubmit={formik.handleSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <ImageUploadField
                  className="w-40"
                  label="Profile Photo"
                  aspectRatio={1}
                  rounded
                  useUploadMutation={useUploadUserImageMutation}
                  previewUrl={formik.values.photoUrl}
                  onUploaded={(imageKey, imageUrl) => {
                    void formik.setFieldValue('photoKey', imageKey);
                    void formik.setFieldValue('photoUrl', imageUrl);
                  }}
                  onUploadingChange={onUploadingChange}
                  onRemove={() => {
                    void formik.setFieldValue('photoKey', '');
                    void formik.setFieldValue('photoUrl', '');
                  }}
                />
              </div>
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-muted-foreground shrink-0 text-xs font-semibold tracking-[0.14em] uppercase">
                    Public · shown on your profile
                  </h2>
                  <Separator className="flex-1" />
                </div>
                <FormField
                  formik={formik}
                  name="displayName"
                  label="Display Name"
                />
                <FormField
                  formik={formik}
                  name="username"
                  label="Username"
                  invalid={
                    usernameTaken ||
                    (formik.errors.username != null && formik.touched.username)
                  }
                  message={usernameTaken ? 'Username is taken' : undefined}
                />
              </div>
              <div className="mt-4 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-muted-foreground shrink-0 text-xs font-semibold tracking-[0.14em] uppercase">
                    Private · visible to organizers
                  </h2>
                  <Separator className="flex-1" />
                </div>
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
              </div>
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
                disabled={
                  loading ||
                  !formik.isValid ||
                  !formik.dirty ||
                  isUploading ||
                  usernameTaken
                }
                size="lg"
              >
                Save changes
                {loading ? <Spinner /> : null}
              </Button>
            </div>
          </form>
        </div>
        <GroupsCard />
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUnlinkConfirm(true)}
                >
                  Unlink
                </Button>
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
          {user?.is_organizer && (
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
          )}
        </div>
        <div className="bg-card text-card-foreground flex flex-col gap-4 rounded-lg p-8 shadow-lg">
          <h2 className="text-lg font-medium">Organizer access</h2>
          {(user?.is_organizer ?? false) ? (
            <p className="text-sm font-medium text-green-600">
              You're an organizer.
            </p>
          ) : (user?.has_organizer_request ?? false) ? (
            <p className="text-muted-foreground text-sm">
              Your organizer request is pending review.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground text-sm">
                Want to host meetups? Request organizer access.
              </span>
              <Button
                onClick={onRequestOrganizer}
                disabled={isRequestingOrganizer || user == null}
              >
                Request organizer access
                {isRequestingOrganizer ? <Spinner /> : null}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={showUnlinkConfirm}
        onOpenChange={(open) => {
          if (!open) setShowUnlinkConfirm(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink Discord</DialogTitle>
            <DialogDescription>
              You'll lose access to any groups (and their meetups) you're in
              only through this Discord server. You can relink at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowUnlinkConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onUnlinkDiscord}
              disabled={isUnlinking}
            >
              Unlink
              {isUnlinking ? <Spinner /> : null}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
};

export default AccountPage;
