import { type GalleryInfo, type GalleryPreview } from '@keebmeet/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../config';
import { meetupSlice } from './meetupSlice';
import { type RootState } from './store';

export interface CreateGalleryOptions {
  meetupId: string;
  gallery: string;
  contributorName?: string;
}

/** Organizer-moderation delete: removes another attendee's link. */
export interface DeleteGalleryForUserOptions {
  meetupId: string;
  targetUserId: string;
}

/** Organizer delete by record id — for archive links, which have no user id. */
export interface DeleteGalleryByIdOptions {
  meetupId: string;
  galleryId: string;
}

export const gallerySlice = createApi({
  reducerPath: 'gallerySlice',
  tagTypes: ['Galleries'],
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
    getMeetupGallery: builder.query<GalleryInfo[], string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/galleries`,
      }),
      providesTags: (result, error, meetupId) => [
        { type: 'Galleries', id: meetupId },
      ],
    }),
    // Server-scraped OpenGraph previews, keyed by user_id. Shares the per-meetup
    // tag so adding/removing a link refreshes previews too.
    getMeetupGalleryPreviews: builder.query<GalleryPreview[], string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/galleries/previews`,
      }),
      providesTags: (result, error, meetupId) => [
        { type: 'Galleries', id: meetupId },
      ],
    }),
    createGallery: builder.mutation<GalleryInfo, CreateGalleryOptions>({
      query: ({ meetupId, gallery, contributorName }) => ({
        url: `meetups/${meetupId}/gallery`,
        method: 'POST',
        body: { gallery: gallery, contributor_name: contributorName },
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'Galleries', id: meetupId },
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
    deleteGallery: builder.mutation<void, string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/gallery`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, meetupId) => [
        { type: 'Galleries', id: meetupId },
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
    deleteGalleryForUser: builder.mutation<
      void,
      DeleteGalleryForUserOptions
    >({
      query: ({ meetupId, targetUserId }) => ({
        url: `meetups/${meetupId}/gallery/${targetUserId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'Galleries', id: meetupId },
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
    deleteGalleryById: builder.mutation<void, DeleteGalleryByIdOptions>({
      query: ({ meetupId, galleryId }) => ({
        url: `meetups/${meetupId}/galleries/${galleryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'Galleries', id: meetupId },
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
  useGetMeetupGalleryQuery,
  useGetMeetupGalleryPreviewsQuery,
  useCreateGalleryMutation,
  useDeleteGalleryMutation,
  useDeleteGalleryForUserMutation,
  useDeleteGalleryByIdMutation,
} = gallerySlice;
