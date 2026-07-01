import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  type DiscordChannel,
  type DiscordServer,
  type OrganizerRequestInfo,
  type User,
} from '@keebmeet/shared';
import config from '../config';
import { type RootState } from './store';

export const userSlice = createApi({
  reducerPath: 'userSlice',
  tagTypes: ['User', 'Users', 'OrganizerRequests'],
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
    getUser: builder.query<User, number>({
      query: (userId) => ({
        url: `/users/${userId}`,
      }),
      providesTags: ['User'],
    }),
    getAllUsers: builder.query<User[], void>({
      query: () => ({
        url: `/users`,
      }),
      providesTags: ['Users'],
    }),
    getUserDiscordServers: builder.query<DiscordServer[], number>({
      query: (userId) => ({
        url: `/users/${userId}/discord/servers`,
      }),
      providesTags: ['User'],
    }),
    getUserDiscordServerChannels: builder.query<
      DiscordChannel[],
      { userId: number; serverId: string }
    >({
      query: ({ userId, serverId }) => ({
        url: `/users/${userId}/discord/servers/${serverId}/channels`,
      }),
      providesTags: ['User'],
    }),
    authorizeEventbrite: builder.mutation<void, string>({
      query: (accessCode) => ({
        url: `/oauth2/eventbrite`,
        method: 'POST',
        body: {
          access_code: accessCode,
        },
      }),
      invalidatesTags: ['User'],
    }),
    // Request organizer access for the logged-in user.
    requestOrganizer: builder.mutation<void, void>({
      query: () => ({
        url: `/organizer-requests`,
        method: 'POST',
      }),
      invalidatesTags: ['User', 'OrganizerRequests'],
    }),
    getOrganizerRequests: builder.query<OrganizerRequestInfo[], void>({
      query: () => ({
        url: `/organizer-requests`,
      }),
      providesTags: ['OrganizerRequests'],
    }),
    approveOrganizerRequest: builder.mutation<void, number>({
      query: (requestId) => ({
        url: `/organizer-requests/${requestId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['OrganizerRequests', 'User'],
    }),
    denyOrganizerRequest: builder.mutation<void, number>({
      query: (requestId) => ({
        url: `/organizer-requests/${requestId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['OrganizerRequests'],
    }),
  }),
});

export const {
  useGetUserQuery,
  useGetAllUsersQuery,
  useGetUserDiscordServersQuery,
  useGetUserDiscordServerChannelsQuery,
  useAuthorizeEventbriteMutation,
  useRequestOrganizerMutation,
  useGetOrganizerRequestsQuery,
  useApproveOrganizerRequestMutation,
  useDenyOrganizerRequestMutation,
} = userSlice;
