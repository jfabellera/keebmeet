import {
  type GalleryInfo,
  type GalleryPreview,
  type UserGalleryInfo,
} from '@keebmeet/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../config';
import { apiCacheDefaults } from './apiCacheDefaults';
import { meetupSlice } from './meetupSlice';
import { type RootState } from './store';

export interface CreateGalleryOptions {
  meetupId: string;
  gallery: string;
  contributorName?: string;
}

export interface EditGalleryOptions {
  meetupId: string;
  galleryId: string;
  gallery: string;
  title?: string | null;
  coverImageKey?: string | null;
}

export interface TransferGalleryOptions {
  meetupId: string;
  galleryId: string;
  username: string;
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
  ...apiCacheDefaults,
  tagTypes: ['Galleries', 'UserGalleries'],
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
    // Every account-linked gallery a user has, across meetups, for their profile.
    getUserGalleries: builder.query<UserGalleryInfo[], string>({
      query: (username) => ({
        url: `users/${username}/galleries`,
      }),
      providesTags: (result, error, username) => [
        { type: 'UserGalleries', id: username },
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
    editGallery: builder.mutation<GalleryInfo, EditGalleryOptions>({
      query: ({ meetupId, galleryId, gallery, title, coverImageKey }) => ({
        url: `meetups/${meetupId}/galleries/${galleryId}`,
        method: 'PUT',
        body: {
          gallery,
          title: title ?? null,
          cover_image_key: coverImageKey ?? null,
        },
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'Galleries', id: meetupId },
      ],
    }),
    uploadGalleryImage: builder.mutation<
      { image_key: string; image_url: string },
      { meetupId: string; file: File }
    >({
      query: ({ meetupId, file }) => {
        const body = new FormData();
        body.append('image', file);
        return {
          url: `meetups/${meetupId}/gallery/image`,
          method: 'POST',
          body,
        };
      },
    }),
    transferGallery: builder.mutation<GalleryInfo, TransferGalleryOptions>({
      query: ({ meetupId, galleryId, username }) => ({
        url: `meetups/${meetupId}/galleries/${galleryId}/transfer`,
        method: 'POST',
        body: { username },
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'Galleries', id: meetupId },
      ],
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
    deleteGalleryForUser: builder.mutation<void, DeleteGalleryForUserOptions>({
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
  useGetUserGalleriesQuery,
  useCreateGalleryMutation,
  useEditGalleryMutation,
  useUploadGalleryImageMutation,
  useTransferGalleryMutation,
  useDeleteGalleryMutation,
  useDeleteGalleryForUserMutation,
  useDeleteGalleryByIdMutation,
} = gallerySlice;
