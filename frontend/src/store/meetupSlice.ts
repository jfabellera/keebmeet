import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { MeetupInfo } from '../../../backend/src/controllers/meetups';
import { type MeetupDisplayAssets } from '../../../backend/src/interfaces/meetupInterfaces';
import { type MeetupDiscordMessageInfo } from '../../../backend/src/interfaces/userInterfaces';
import {
  type CreateMeetupFromEventbritePayload,
  type CreateMeetupPayload,
  type EditMeetupPayload,
} from '../../../backend/src/util/validator';
import config from '../config';
import { type RootState } from './store';

export interface GetMeetupsOptions {
  detail_level?: string;
  by_organizer_id?: number[];
}

interface EditMeetupOptions {
  meetupId: number;
  payload: EditMeetupPayload;
}

export const meetupSlice = createApi({
  reducerPath: 'meetupSlice',
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
    getMeetup: builder.query<MeetupInfo, number>({
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
    getMeetupDisplayAssets: builder.query<MeetupDisplayAssets, number>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/display-assets`,
      }),
      providesTags: (result, error, arg) => [
        { type: 'Display Assets', id: arg },
      ],
    }),
    getMeetupDiscordMessage: builder.query<
      MeetupDiscordMessageInfo | null,
      number
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
      { meetupId: number; server_id: string; channel_id: string }
    >({
      query: ({ meetupId, server_id, channel_id }) => ({
        url: `meetups/${meetupId}/discord/message`,
        method: 'POST',
        body: { server_id, channel_id },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'DiscordMessage', id: arg.meetupId },
      ],
    }),
    updateMeetupDiscordMessage: builder.mutation<
      MeetupDiscordMessageInfo,
      number
    >({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/discord/message`,
        method: 'PUT',
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'DiscordMessage', id: arg },
      ],
    }),
    deleteMeetupDiscordMessage: builder.mutation<void, number>({
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
  useCreateMeetupFromEventbriteMutation,
  useEditMeetupMutation,
  useGetMeetupDisplayAssetsQuery,
  useGetMeetupDiscordMessageQuery,
  useCreateMeetupDiscordMessageMutation,
  useUpdateMeetupDiscordMessageMutation,
  useDeleteMeetupDiscordMessageMutation,
} = meetupSlice;
