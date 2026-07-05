import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { type SimpleTicketInfo } from '@keebmeet/shared';
import { type CreateTicketPayload } from '@keebmeet/shared';
import config from '../config';
import { type RootState } from './store';

export type TicketHolder = NonNullable<CreateTicketPayload['ticket_holder']>;

export interface CreateTicketOptions {
  meetupId: string;
  /** Optional override; when omitted the requestor's own details are used. */
  ticketHolder?: TicketHolder;
}

export interface UpdateTicketOptions {
  ticketId: string;
  ticketHolder: TicketHolder;
}

/** Subset of the Ticket entity the RSVP page needs to prefill its form. */
export interface TicketDetails {
  id: string;
  ticket_holder_display_name: string;
  ticket_holder_first_name: string;
  ticket_holder_last_name: string;
  ticket_holder_email: string;
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
    getTickets: builder.query<SimpleTicketInfo[], string>({
      query: (userId) => ({
        url: `users/${userId}/tickets`,
      }),
      providesTags: ['Tickets'],
    }),
    getTicket: builder.query<TicketDetails, string>({
      query: (ticketId) => ({
        url: `tickets/${ticketId}`,
      }),
      providesTags: (result, error, ticketId) => [
        { type: 'Tickets', id: ticketId },
      ],
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
    updateTicket: builder.mutation<void, UpdateTicketOptions>({
      query: ({ ticketId, ticketHolder }) => ({
        url: `tickets/${ticketId}`,
        method: 'PUT',
        body: { ticket_holder: ticketHolder },
      }),
      invalidatesTags: (result, error, { ticketId }) => [
        'Tickets',
        { type: 'Tickets', id: ticketId },
      ],
    }),
    deleteTicket: builder.mutation<void, string>({
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
  useGetTicketQuery,
  useCreateTicketMutation,
  useUpdateTicketMutation,
  useDeleteTicketMutation,
} = ticketSlice;
