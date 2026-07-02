import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authSlice, { refreshSession } from './authSlice';
import { eventbriteSlice } from './eventbriteSlice';
import { meetupSlice } from './meetupSlice';
import { organizerSlice } from './organizerSlice';
import { ticketSlice } from './ticketSlice';
import { userSlice } from './userSlice';

export const store = configureStore({
  reducer: {
    [meetupSlice.reducerPath]: meetupSlice.reducer,
    [ticketSlice.reducerPath]: ticketSlice.reducer,
    [organizerSlice.reducerPath]: organizerSlice.reducer,
    [userSlice.reducerPath]: userSlice.reducer,
    [eventbriteSlice.reducerPath]: eventbriteSlice.reducer,
    user: authSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(meetupSlice.middleware)
      .concat(ticketSlice.middleware)
      .concat(organizerSlice.middleware)
      .concat(userSlice.middleware)
      .concat(eventbriteSlice.middleware),
});

setupListeners(store.dispatch);

// Re-sync the session token with the server on every page load so role changes
// made since login (e.g. organizer approval) take effect without a re-login.
// Dispatched before the first render so guards can wait on the refreshing flag.
if (localStorage.getItem('token') != null) {
  void store.dispatch(refreshSession());
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
