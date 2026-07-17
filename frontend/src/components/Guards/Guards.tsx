import { type SerializedError } from '@reduxjs/toolkit';
import { type FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { useGetMeetupQuery, useGetMeetupsQuery } from '../../store/meetupSlice';

interface GuardProps {
  children: ReactNode;
}

/**
 * True when an RTK Query error is a 404. Used to distinguish "this resource
 * doesn't exist" (redirect the user away) from transient network/server errors
 * (where we'd rather not kick them off the page).
 */
export const isNotFoundError = (
  error: FetchBaseQueryError | SerializedError | undefined
): boolean => {
  return error != null && 'status' in error && error.status === 404;
};

/**
 * Restricts a route to logged-in users. Logged-out visitors are sent to the
 * homepage.
 */
export const RequireAuth = ({ children }: GuardProps): ReactNode => {
  const { isLoggedIn } = useAppSelector((state) => state.user);

  if (!isLoggedIn) return <Navigate to="/" replace />;

  return <>{children}</>;
};

/**
 * Restricts a route to logged-out visitors (e.g. login/register). Already
 * logged-in users are sent to the homepage.
 */
export const RequireGuest = ({ children }: GuardProps): ReactNode => {
  const { isLoggedIn } = useAppSelector((state) => state.user);

  if (isLoggedIn) return <Navigate to="/" replace />;

  return <>{children}</>;
};

/**
 * Restricts a route to admins. Non-admins (and logged-out visitors) are sent to
 * the homepage.
 */
export const RequireAdmin = ({ children }: GuardProps): ReactNode => {
  const { user, refreshing } = useAppSelector((state) => state.user);

  if (user == null) return <Navigate to="/" replace />;

  // Owners outrank admins and may use any admin-gated page.
  if (!(user.isAdmin || user.isOwner)) {
    if (refreshing) return null;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

/**
 * Restricts a route to organizers. Non-organizers (and logged-out visitors)
 * are sent to the homepage.
 */
export const RequireOrganizer = ({ children }: GuardProps): ReactNode => {
  const { user, refreshing } = useAppSelector((state) => state.user);

  if (user == null) return <Navigate to="/" replace />;

  if (!user.isOrganizer) {
    if (refreshing) return null;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

/**
 * Restricts a route to a meetup that exists. If the `:meetupId` param is
 * missing/invalid or the meetup can't be found, the visitor is sent to the
 * homepage.
 */
export const RequireMeetup = ({ children }: GuardProps): ReactNode => {
  const { meetupId } = useParams();
  const id = meetupId ?? '';
  const { error, isLoading } = useGetMeetupQuery(id, {
    skip: id === '',
  });

  if (id === '') return <Navigate to="/" replace />;
  // Wait for the lookup before deciding so valid meetups don't flash a redirect.
  if (isLoading) return null;
  if (isNotFoundError(error)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

/**
 * Restricts a route to organizers of the specific meetup in the URL. Anyone who
 * isn't an organizer of that meetup — including logged-out visitors, regular
 * users, and organizers of other meetups — is sent to the homepage. A
 * non-existent meetup also redirects, since nobody organizes it.
 */
export const RequireMeetupOrganizer = ({ children }: GuardProps): ReactNode => {
  const { user } = useAppSelector((state) => state.user);
  const { meetupId } = useParams();
  const id = meetupId ?? '';

  const { data: organizedMeetups, isLoading } = useGetMeetupsQuery(
    { by_organizer_id: user != null ? [user.id] : [] },
    { skip: user == null }
  );

  if (user == null || id === '') return <Navigate to="/" replace />;
  // Wait for the lookup before deciding so authorized organizers don't flash a
  // redirect on a slow load.
  if (isLoading) return null;

  const organizesMeetup =
    organizedMeetups?.some((meetup) => meetup.slug === id) ?? false;

  if (!organizesMeetup) return <Navigate to="/" replace />;

  return <>{children}</>;
};
