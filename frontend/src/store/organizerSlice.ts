import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { type TicketInfo } from '../../../backend/src/controllers/meetups';
import {
  type RaffleRecordResponse,
  type RollRaffleWinnerResponse,
} from '../../../backend/src/interfaces/rafflesInterfaces';
import {
  EditTicketPayload,
  type ClaimRaffleWinnerPayload,
  type RollRaffleWinnerPayload,
  type UnclaimRaffleWinnerPayload,
} from '../../../backend/src/util/validator';
import config from '../config';
import { type RootState } from './store';

export interface GetMeetupAttendeesOptions {
  meetup_id: number;
  params?: {
    detail_level?: string;
  };
}

export interface RollRaffleWinnerOptions {
  meetupId: number;
  payload?: RollRaffleWinnerPayload;
}

export interface ClaimRaffleWinnerOptions {
  ticketId: number;
  payload?: ClaimRaffleWinnerPayload;
}

export interface UnclaimRaffleWinnerOptions {
  raffleRecordId: number;
  payload: UnclaimRaffleWinnerPayload;
}

export interface UpdateAttendeeOptions {
  ticketId: number;
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
    checkInAttendee: builder.mutation<void, number>({
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
    getRaffleHistory: builder.query<RaffleRecordResponse[], number>({
      query: (meetupId) => ({
        url: `meetups/${meetupId}/raffles`,
      }),
      providesTags: (result, error, arg) => [{ type: 'Raffles', id: arg }],
    }),
    getRaffleRecord: builder.query<RaffleRecordResponse, number>({
      query: (raffleRecordId) => ({
        url: `raffles/${raffleRecordId}`,
      }),
      providesTags: (result, error, arg) => [{ type: 'Raffle', id: arg }],
    }),
    markRaffleAsDisplayed: builder.mutation<void, number>({
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
  useRollRaffleWinnerMutation,
  useClaimRaffleWinnerMutation,
  useUnClaimRaffleWinnerMutation,
  useGetRaffleHistoryQuery,
  useGetRaffleRecordQuery,
  useMarkRaffleAsDisplayedMutation,
} = organizerSlice;
