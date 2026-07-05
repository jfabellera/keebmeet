import {
  EditTicketPayload,
  type ClaimRaffleWinnerPayload,
  type RaffleRecordResponse,
  type RollRaffleWinnerPayload,
  type RollRaffleWinnerResponse,
  type TicketInfo,
  type UnclaimRaffleWinnerPayload,
} from '@keebmeet/shared';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../config';
import { type RootState } from './store';

export interface GetMeetupAttendeesOptions {
  meetup_id: string;
  params?: {
    detail_level?: string;
  };
}

export interface RollRaffleWinnerOptions {
  meetupId: string;
  payload?: RollRaffleWinnerPayload;
}

export interface ClaimRaffleWinnerOptions {
  ticketId: string;
  payload?: ClaimRaffleWinnerPayload;
}

export interface UnclaimRaffleWinnerOptions {
  raffleRecordId: string;
  payload: UnclaimRaffleWinnerPayload;
}

export interface UpdateAttendeeOptions {
  ticketId: string;
  payload: EditTicketPayload;
}

export const organizerSlice = createApi({
  reducerPath: 'organizerSlice',
  tagTypes: ['Attendees', 'Raffles', 'Raffle'],
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
    getMeetupAttendees: builder.query<TicketInfo[], GetMeetupAttendeesOptions>({
      query: (options) => ({
        url: `meetups/${options.meetup_id}/attendees`,
        params: options.params,
      }),
      providesTags: (result, error, arg) => [
        { type: 'Attendees', id: arg.meetup_id },
      ],
    }),
    checkInAttendee: builder.mutation<void, string>({
      query: (ticketId) => ({
        url: `tickets/${ticketId}/checkin`,
        method: 'POST',
      }),
      invalidatesTags: ['Attendees'],
    }),
    editAttendee: builder.mutation<void, UpdateAttendeeOptions>({
      query: (options) => ({
        url: `tickets/${options.ticketId}`,
        method: 'PUT',
        body: options.payload,
      }),
      invalidatesTags: ['Attendees'],
    }),
    rollRaffleWinner: builder.mutation<
      RollRaffleWinnerResponse,
      RollRaffleWinnerOptions
    >({
      query: (options) => ({
        url: `meetups/${options.meetupId}/raffle`,
        method: 'POST',
        body: options.payload,
      }),
      invalidatesTags: ['Raffles'],
    }),
    claimRaffleWinner: builder.mutation<void, ClaimRaffleWinnerOptions>({
      query: (options) => ({
        url: `tickets/${options.ticketId}/claim`,
        method: 'POST',
        body: options.payload,
      }),
      invalidatesTags: ['Raffles', 'Raffle'], // TODO(jan): Invalidate by id
    }),
    unClaimRaffleWinner: builder.mutation<void, UnclaimRaffleWinnerOptions>({
      query: (options) => ({
        url: `raffles/${options.raffleRecordId}/unclaim`,
        method: 'POST',
        body: options.payload,
      }),
      invalidatesTags: ['Raffles', 'Raffle'], // TODO(jan): Invalidate by id
    }),
    deleteRaffleRecord: builder.mutation<void, string>({
      query: (raffleRecordId) => ({
        url: `raffles/${raffleRecordId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Raffles', 'Raffle'],
    }),
    getRaffleHistory: builder.query<RaffleRecordResponse[], string>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/raffles`,
      }),
      providesTags: (result, error, arg) => [{ type: 'Raffles', id: arg }],
    }),
    getRaffleRecord: builder.query<RaffleRecordResponse, string>({
      query: (raffleRecordId) => ({
        url: `raffles/${raffleRecordId}`,
      }),
      providesTags: (result, error, arg) => [{ type: 'Raffle', id: arg }],
    }),
    markRaffleAsDisplayed: builder.mutation<void, string>({
      query: (raffleId) => ({
        url: `raffles/${raffleId}/displayed`,
        method: 'POST',
      }),
      invalidatesTags: ['Raffles'],
    }),
  }),
});

export const {
  useGetMeetupAttendeesQuery,
  useCheckInAttendeeMutation,
  useEditAttendeeMutation,
  useRollRaffleWinnerMutation,
  useClaimRaffleWinnerMutation,
  useUnClaimRaffleWinnerMutation,
  useDeleteRaffleRecordMutation,
  useGetRaffleHistoryQuery,
  useGetRaffleRecordQuery,
  useMarkRaffleAsDisplayedMutation,
} = organizerSlice;
