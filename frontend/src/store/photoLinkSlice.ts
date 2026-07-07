import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { type PhotoLinkInfo, type PhotoLinkPreview } from '@keebmeet/shared';
import config from '../config';
import { type RootState } from './store';

export interface CreatePhotoLinkOptions {
  meetupId: string;
  photoLink: string;
}

/** Organizer-moderation delete: removes another attendee's link. */
export interface DeletePhotoLinkForUserOptions {
  meetupId: string;
  targetUserId: string;
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
      query: ({ meetupId, photoLink }) => ({
        url: `meetups/${meetupId}/photo-link`,
        method: 'POST',
        body: { photo_link: photoLink },
      }),
      invalidatesTags: (result, error, { meetupId }) => [
        { type: 'PhotoLinks', id: meetupId },
      ],
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
    }),
    deletePhotoLinkForUser: builder.mutation<void, DeletePhotoLinkForUserOptions>(
      {
        query: ({ meetupId, targetUserId }) => ({
          url: `meetups/${meetupId}/photo-link/${targetUserId}`,
          method: 'DELETE',
        }),
        invalidatesTags: (result, error, { meetupId }) => [
          { type: 'PhotoLinks', id: meetupId },
        ],
      }
    ),
  }),
});

export const {
  useGetMeetupPhotoLinksQuery,
  useGetMeetupPhotoLinkPreviewsQuery,
  useCreatePhotoLinkMutation,
  useDeletePhotoLinkMutation,
  useDeletePhotoLinkForUserMutation,
} = photoLinkSlice;
