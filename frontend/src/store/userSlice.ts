import {
  type DiscordChannel,
  type DiscordServer,
  type OrganizerRequestInfo,
  type User,
} from '@keebmeet/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../config';
import { apiCacheDefaults } from './apiCacheDefaults';
import { type RootState } from './store';

export const userSlice = createApi({
  reducerPath: 'userSlice',
  ...apiCacheDefaults,
  tagTypes: ['User', 'Users', 'Organizers', 'OrganizerRequests'],
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
    getUser: builder.query<User, string>({
      query: (userId) => ({
        url: `/users/${userId}`,
      }),
      providesTags: ['User'],
    }),
    // Uploads a profile photo to R2, returning its temp key + preview URL. Used
    // during registration (no token) and on the account page.
    uploadUserImage: builder.mutation<
      { image_key: string; image_url: string },
      File
    >({
      query: (file) => {
        const body = new FormData();
        body.append('image', file);
        return { url: `users/photo`, method: 'POST', body };
      },
    }),
    getAllUsers: builder.query<User[], void>({
      query: () => ({
        url: `/users`,
      }),
      providesTags: ['Users'],
    }),
    getOrganizers: builder.query<User[], void>({
      query: () => ({
        url: `/users/organizers`,
      }),
      providesTags: ['Organizers'],
    }),
    getUserDiscordServers: builder.query<DiscordServer[], string>({
      query: (userId) => ({
        url: `/users/${userId}/discord/servers`,
      }),
      providesTags: ['User'],
    }),
    getUserDiscordServerChannels: builder.query<
      DiscordChannel[],
      { userId: string; serverId: string }
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
    approveOrganizerRequest: builder.mutation<void, string>({
      query: (requestId) => ({
        url: `/organizer-requests/${requestId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['OrganizerRequests', 'User'],
    }),
    denyOrganizerRequest: builder.mutation<void, string>({
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
  useUploadUserImageMutation,
  useGetAllUsersQuery,
  useGetOrganizersQuery,
  useGetUserDiscordServersQuery,
  useGetUserDiscordServerChannelsQuery,
  useAuthorizeEventbriteMutation,
  useRequestOrganizerMutation,
  useGetOrganizerRequestsQuery,
  useApproveOrganizerRequestMutation,
  useDenyOrganizerRequestMutation,
} = userSlice;
