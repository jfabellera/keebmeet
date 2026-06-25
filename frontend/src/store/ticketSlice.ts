import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { type SimpleTicketInfo } from '../../../backend/src/controllers/tickets';
import { type CreateTicketPayload } from '../../../backend/src/util/validator';
import config from '../config';
import { type RootState } from './store';

export interface CreateTicketOptions {
  meetupId: number;
  /** Optional override; when omitted the requestor's own details are used. */
  ticketHolder?: CreateTicketPayload['ticket_holder'];
}

export const ticketSlice = createApi({
  reducerPath: 'ticketSlice',
  tagTypes: ['Tickets'],
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
    getTickets: builder.query<SimpleTicketInfo[], number>({
      query: (userId) => ({
        url: `users/${userId}/tickets`,
      }),
      providesTags: ['Tickets'],
    }),
    createTicket: builder.mutation<void, CreateTicketOptions>({
      query: ({ meetupId, ticketHolder }) => ({
        url: `meetups/${meetupId}/rsvp`,
        method: 'POST',
        // Omit the body entirely to fall back to the requestor's details.
        body: ticketHolder != null ? { ticket_holder: ticketHolder } : undefined,
      }),
      invalidatesTags: ['Tickets'],
    }),
    deleteTicket: builder.mutation<void, number>({
      query: (ticketId) => ({
        url: `tickets/${ticketId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tickets'],
    }),
  }),
});

export const {
  useGetTicketsQuery,
  useCreateTicketMutation,
  useDeleteTicketMutation,
} = ticketSlice;
