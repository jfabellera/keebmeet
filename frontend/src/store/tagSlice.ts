import {
  type CreateTagPayload,
  type EditTagPayload,
  type TagInfo,
} from '@keebmeet/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../config';
import { apiCacheDefaults } from './apiCacheDefaults';
import { type RootState } from './store';

export const tagSlice = createApi({
  reducerPath: 'tagSlice',
  ...apiCacheDefaults,
  tagTypes: ['Tags'],
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
    getTags: builder.query<TagInfo[], void>({
      query: () => ({
        url: `/tags`,
      }),
      providesTags: ['Tags'],
    }),
    createTag: builder.mutation<TagInfo, CreateTagPayload>({
      query: (body) => ({
        url: `/tags`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Tags'],
    }),
    editTag: builder.mutation<
      TagInfo,
      { tagId: string; changes: EditTagPayload }
    >({
      query: ({ tagId, changes }) => ({
        url: `/tags/${tagId}`,
        method: 'PUT',
        body: changes,
      }),
      invalidatesTags: ['Tags'],
    }),
    deleteTag: builder.mutation<void, string>({
      query: (tagId) => ({
        url: `/tags/${tagId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tags'],
    }),
  }),
});

export const {
  useGetTagsQuery,
  useCreateTagMutation,
  useEditTagMutation,
  useDeleteTagMutation,
} = tagSlice;
