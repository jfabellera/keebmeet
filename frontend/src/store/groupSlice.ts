import {
  type CreateGroupPayload,
  type DiscordServer,
  type EditGroupPayload,
  type GroupInfo,
  type JoinGroupPayload,
} from '@keebmeet/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../config';
import { apiCacheDefaults } from './apiCacheDefaults';
import { type RootState } from './store';

export const groupSlice = createApi({
  reducerPath: 'groupSlice',
  ...apiCacheDefaults,
  tagTypes: ['Groups', 'MyGroups'],
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
    getGroups: builder.query<GroupInfo[], void>({
      query: () => ({
        url: `/groups`,
      }),
      providesTags: ['Groups'],
    }),
    // The Discord servers the KeebMeet bot is in, for the group server picker.
    getBotDiscordServers: builder.query<DiscordServer[], void>({
      query: () => ({
        url: `/groups/discord-servers`,
      }),
    }),
    createGroup: builder.mutation<GroupInfo, CreateGroupPayload>({
      query: (body) => ({
        url: `/groups`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Groups'],
    }),
    editGroup: builder.mutation<
      GroupInfo,
      { groupId: string; changes: EditGroupPayload }
    >({
      query: ({ groupId, changes }) => ({
        url: `/groups/${groupId}`,
        method: 'PUT',
        body: changes,
      }),
      invalidatesTags: ['Groups'],
    }),
    deleteGroup: builder.mutation<void, string>({
      query: (groupId) => ({
        url: `/groups/${groupId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Groups'],
    }),
    // The groups the logged-in user has joined.
    getMyGroups: builder.query<GroupInfo[], void>({
      query: () => ({
        url: `/groups/mine`,
      }),
      providesTags: ['MyGroups'],
    }),
    joinGroup: builder.mutation<GroupInfo, JoinGroupPayload>({
      query: (body) => ({
        url: `/groups/join`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyGroups'],
    }),
    leaveGroup: builder.mutation<void, string>({
      query: (groupId) => ({
        url: `/groups/${groupId}/leave`,
        method: 'DELETE',
      }),
      invalidatesTags: ['MyGroups'],
    }),
  }),
});

export const {
  useGetGroupsQuery,
  useGetBotDiscordServersQuery,
  useCreateGroupMutation,
  useEditGroupMutation,
  useDeleteGroupMutation,
  useGetMyGroupsQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
} = groupSlice;
