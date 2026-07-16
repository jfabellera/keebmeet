import type { MeetupInfo } from '@keebmeet/shared';
import {
  type CreateArchiveMeetupPayload,
  type CreateMeetupFromEventbritePayload,
  type CreateMeetupPayload,
  type EditMeetupPayload,
  type MeetupDiscordMessageInfo,
  type MeetupDisplayAssets,
  type TransferMeetupPayload,
} from '@keebmeet/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../config';
import { apiCacheDefaults } from './apiCacheDefaults';
import { type RootState } from './store';

export interface GetMeetupsOptions {
  detail_level?: string;
  by_organizer_id?: string[];
}

interface EditMeetupOptions {
  meetupId: string;
  payload: EditMeetupPayload;
}

interface TransferMeetupOptions {
  meetupId: string;
  payload: TransferMeetupPayload;
}

export const meetupSlice = createApi({
  reducerPath: 'meetupSlice',
  ...apiCacheDefaults,
  tagTypes: [
    'Meetups',
    'Meetup',
    'Attendees',
    'Display Assets',
    'DiscordMessage',
  ],
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
    getMeetups: builder.query<MeetupInfo[], GetMeetupsOptions>({
      query: (options) => ({
        url: `meetups/`,
        params: options,
      }),
      providesTags: ['Meetups'],
    }),
    getMeetup: builder.query<MeetupInfo, string>({
      query: (id) => ({
        url: `meetups/${id}`,
      }),
      providesTags: (result, error, arg) => [{ type: 'Meetup', id: arg }],
    }),
    createMeetup: builder.mutation<void, CreateMeetupPayload>({
      query: (payload) => ({
        url: `meetups/`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Meetups'],
    }),
    createArchiveMeetup: builder.mutation<void, CreateArchiveMeetupPayload>({
      query: (payload) => ({
        url: `meetups/archive`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Meetups'],
    }),
    uploadMeetupImage: builder.mutation<
      { image_key: string; image_url: string },
      File
    >({
      query: (file) => {
        const body = new FormData();
        body.append('image', file);
        // Don't set Content-Type — the browser adds the multipart boundary.
        return {
          url: `meetups/image`,
          method: 'POST',
          body,
        };
      },
    }),
    createMeetupFromEventbrite: builder.mutation<
      void,
      CreateMeetupFromEventbritePayload
    >({
      query: (payload) => ({
        url: `meetups/eventbrite`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Meetups'],
    }),
    editMeetup: builder.mutation<void, EditMeetupOptions>({
      query: ({ payload, meetupId }) => ({
        url: `meetups/${meetupId}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: (result, error, arg) => [
        'Meetup',
        'Meetups',
        { type: 'Display Assets', id: arg.meetupId },
      ],
    }),
    deleteMeetup: builder.mutation<void, string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, arg) => [
        'Meetups',
        { type: 'Meetup', id: arg },
      ],
    }),
    transferMeetup: builder.mutation<void, TransferMeetupOptions>({
      query: ({ meetupId, payload }) => ({
        url: `meetups/${meetupId}/transfer`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (result, error, arg) => [
        'Meetups',
        { type: 'Meetup', id: arg.meetupId },
      ],
    }),
    getMeetupDisplayAssets: builder.query<MeetupDisplayAssets, string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/display-assets`,
      }),
      providesTags: (result, error, arg) => [
        { type: 'Display Assets', id: arg },
      ],
    }),
    getMeetupDiscordMessage: builder.query<
      MeetupDiscordMessageInfo | null,
      string
    >({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/discord/message`,
      }),
      providesTags: (result, error, arg) => [
        { type: 'DiscordMessage', id: arg },
      ],
    }),
    createMeetupDiscordMessage: builder.mutation<
      MeetupDiscordMessageInfo,
      {
        meetupId: string;
        server_id: string;
        channel_id: string;
        allow_rsvp: boolean;
      }
    >({
      query: ({ meetupId, server_id, channel_id, allow_rsvp }) => ({
        url: `meetups/${meetupId}/discord/message`,
        method: 'POST',
        body: { server_id, channel_id, allow_rsvp },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'DiscordMessage', id: arg.meetupId },
      ],
    }),
    updateMeetupDiscordMessage: builder.mutation<
      MeetupDiscordMessageInfo,
      { meetupId: string; allow_rsvp?: boolean }
    >({
      query: ({ meetupId, allow_rsvp }) => ({
        url: `meetups/${meetupId}/discord/message`,
        method: 'PUT',
        body: { allow_rsvp },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'DiscordMessage', id: arg.meetupId },
      ],
    }),
    deleteMeetupDiscordMessage: builder.mutation<void, string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/discord/message`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'DiscordMessage', id: arg },
      ],
    }),
  }),
});

export const {
  useGetMeetupsQuery,
  useGetMeetupQuery,
  useCreateMeetupMutation,
  useCreateArchiveMeetupMutation,
  useUploadMeetupImageMutation,
  useCreateMeetupFromEventbriteMutation,
  useEditMeetupMutation,
  useDeleteMeetupMutation,
  useTransferMeetupMutation,
  useGetMeetupDisplayAssetsQuery,
  useGetMeetupDiscordMessageQuery,
  useCreateMeetupDiscordMessageMutation,
  useUpdateMeetupDiscordMessageMutation,
  useDeleteMeetupDiscordMessageMutation,
} = meetupSlice;
