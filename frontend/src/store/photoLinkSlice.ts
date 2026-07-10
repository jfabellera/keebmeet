import { type PhotoLinkInfo, type PhotoLinkPreview } from '@keebmeet/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../config';
import { meetupSlice } from './meetupSlice';
import { type RootState } from './store';

export interface CreatePhotoLinkOptions {
  meetupId: string;
  photoLink: string;
  contributorName?: string;
}

/** Organizer-moderation delete: removes another attendee's link. */
export interface DeletePhotoLinkForUserOptions {
  meetupId: string;
  targetUserId: string;
}

/** Organizer delete by record id — for archive links, which have no user id. */
export interface DeletePhotoLinkByIdOptions {
  meetupId: string;
  photoLinkId: string;
}

export const photoLinkSlice = createApi({
  reducerPath: 'photoLinkSlice',
  tagTypes: ['PhotoLinks'],
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.apiUrl}/`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).user.user?.token;

      if (token != null) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return headers;
    },
  }),
  endpoints: (builder) => ({
    getMeetupPhotoLinks: builder.query<PhotoLinkInfo[], string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/photo-links`,
      }),
      providesTags: (result, error, meetupId) => [
        { type: 'PhotoLinks', id: meetupId },
      ],
    }),
    // Server-scraped OpenGraph previews, keyed by user_id. Shares the per-meetup
    // tag so adding/removing a link refreshes previews too.
    getMeetupPhotoLinkPreviews: builder.query<PhotoLinkPreview[], string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/photo-links/previews`,
      }),
      providesTags: (result, error, meetupId) => [
        { type: 'PhotoLinks', id: meetupId },
      ],
    }),
    createPhotoLink: builder.mutation<PhotoLinkInfo, CreatePhotoLinkOptions>({
      query: ({ meetupId, photoLink, contributorName }) => ({
        url: `meetups/${meetupId}/photo-link`,
        method: 'POST',
        body: { photo_link: photoLink, contributor_name: contributorName },
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'PhotoLinks', id: meetupId },
      ],
      // The "has photos" badge on meetup listings is derived from the meetups
      // list query, which lives in a separate API slice. Cross-slice tags can't
      // be declared in `invalidatesTags`, so refresh it once the link settles.
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(meetupSlice.util.invalidateTags(['Meetups']));
        } catch {
          // Mutation failed — nothing to invalidate.
        }
      },
    }),
    // Self-service delete: the backend keys off the requestor's token, so no
    // user id is sent.
    deletePhotoLink: builder.mutation<void, string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/photo-link`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, meetupId) => [
        { type: 'PhotoLinks', id: meetupId },
      ],
      // Deleting may remove the last link, clearing the badge — refresh the list.
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(meetupSlice.util.invalidateTags(['Meetups']));
        } catch {
          // Mutation failed — nothing to invalidate.
        }
      },
    }),
    deletePhotoLinkForUser: builder.mutation<
      void,
      DeletePhotoLinkForUserOptions
    >({
      query: ({ meetupId, targetUserId }) => ({
        url: `meetups/${meetupId}/photo-link/${targetUserId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'PhotoLinks', id: meetupId },
      ],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(meetupSlice.util.invalidateTags(['Meetups']));
        } catch {
          // Mutation failed — nothing to invalidate.
        }
      },
    }),
    deletePhotoLinkById: builder.mutation<void, DeletePhotoLinkByIdOptions>({
      query: ({ meetupId, photoLinkId }) => ({
        url: `meetups/${meetupId}/photo-links/${photoLinkId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'PhotoLinks', id: meetupId },
      ],
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(meetupSlice.util.invalidateTags(['Meetups']));
        } catch {
          // Mutation failed — nothing to invalidate.
        }
      },
    }),
  }),
});

export const {
  useGetMeetupPhotoLinksQuery,
  useGetMeetupPhotoLinkPreviewsQuery,
  useCreatePhotoLinkMutation,
  useDeletePhotoLinkMutation,
  useDeletePhotoLinkForUserMutation,
  useDeletePhotoLinkByIdMutation,
} = photoLinkSlice;
