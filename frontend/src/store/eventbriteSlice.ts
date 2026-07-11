import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { type EventbriteOrganization } from '@keebmeet/shared';
import config from '../config';
import { apiCacheDefaults } from './apiCacheDefaults';
import { type RootState } from './store';

export const eventbriteSlice = createApi({
  reducerPath: 'eventbriteSlice',
  ...apiCacheDefaults,
  tagTypes: ['Organizations', 'Events', 'Custom Questions', 'Ticket Classes'],
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
    getOrganizations: builder.query<EventbriteOrganization[], void>({
      query: () => ({
        url: `/eventbrite/organizations`,
      }),
      providesTags: ['Organizations'],
    }),
    getEvents: builder.query<EventbriteOrganization[], string>({
      query: (organizationId) => ({
        url: `/eventbrite/organizations/${organizationId}/events`,
      }),
      providesTags: ['Events'],
    }),
    getCustomQuestions: builder.query<EventbriteOrganization[], string>({
      query: (eventId) => ({
        url: `/eventbrite/events/${eventId}/questions`,
      }),
      providesTags: ['Custom Questions'],
    }),
    getTicketClasses: builder.query<EventbriteOrganization[], string>({
      query: (eventId) => ({
        url: `/eventbrite/events/${eventId}/tickets`,
      }),
      providesTags: ['Ticket Classes'],
    }),
  }),
});

export const {
  useGetOrganizationsQuery,
  useGetEventsQuery,
  useGetCustomQuestionsQuery,
  useGetTicketClassesQuery,
} = eventbriteSlice;
