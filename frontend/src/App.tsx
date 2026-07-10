import { type ReactNode } from 'react';
import {
  Outlet,
  Route,
  BrowserRouter as Router,
  Routes,
} from 'react-router-dom';
import './App.css';

import CheckInPage from './pages/CheckInPage';
import Homepage from './pages/Homepage';
import LoginPage from './pages/LoginPage';
import ManageMeetupAttendeesPage from './pages/ManageMeetupAttendeesPage';
import ManageMeetupHomePage from './pages/ManageMeetupHomePage';
import ManageMeetupPage from './pages/ManageMeetupPage';
import ManageMeetupSettingsPage from './pages/ManageMeetupSettingsPage';
import NewMeetupPage from './pages/NewMeetupPage';
import OrganizerDashboard from './pages/OrganizerDashboard';
import RafflePage from './pages/RafflePage';
import RegisterPage from './pages/RegisterPage';

import { Provider } from 'react-redux';
import {
  RequireAdmin,
  RequireAuth,
  RequireGuest,
  RequireMeetup,
  RequireMeetupOrganizer,
  RequireOrganizer,
} from './components/Guards/Guards';
import { TooltipProvider } from './components/ui/tooltip';
import AccountPage from './pages/AccountPage';
import AdminPage from './pages/AdminPage';
import AdminRequestsPage from './pages/AdminRequestsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AuthorizeEventbritePage from './pages/AuthorizeEventbritePage';
import DiscordCallbackPage from './pages/DiscordCallbackPage';
import DiscordLinkPage from './pages/DiscordLinkPage';
import { ManageMeetupDisplayPage } from './pages/ManageMeetupDisplayPage';
import MeetupDisplayPage from './pages/MeetupDisplayPage';
import NewArchiveMeetupPage from './pages/NewArchiveMeetupPage';
import NewMeetupFromEventbritePage from './pages/NewMeetupFromEventbritePage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import { store } from './store/store';

const App = (): ReactNode => {
  return (
    <TooltipProvider>
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/meetup/:meetupId" element={<Homepage />} />
            <Route
              path="/login"
              element={
                <RequireGuest>
                  <LoginPage />
                </RequireGuest>
              }
            />
            <Route
              path="/register"
              element={
                <RequireGuest>
                  <RegisterPage />
                </RequireGuest>
              }
            />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/auth/discord/callback"
              element={<DiscordCallbackPage />}
            />
            <Route path="/auth/discord/link" element={<DiscordLinkPage />} />
            {/* Same element as the meetup route so the modal expands in place. */}
            <Route path="/meetup/:meetupId/rsvp" element={<Homepage />} />
            <Route
              path="/organizer"
              element={
                <RequireOrganizer>
                  <OrganizerDashboard />
                </RequireOrganizer>
              }
            />
            <Route
              path="/new-meetup"
              element={
                <RequireOrganizer>
                  <NewMeetupPage />
                </RequireOrganizer>
              }
            />
            <Route
              path="/new-meetup/archive"
              element={
                <RequireOrganizer>
                  <NewArchiveMeetupPage />
                </RequireOrganizer>
              }
            />
            <Route
              path="/new-meetup/eventbrite"
              element={
                <RequireOrganizer>
                  <NewMeetupFromEventbritePage />
                </RequireOrganizer>
              }
            />
            <Route
              path="/meetup/:meetupId/manage/"
              element={
                <RequireMeetupOrganizer>
                  <ManageMeetupPage>
                    <Outlet />
                  </ManageMeetupPage>
                </RequireMeetupOrganizer>
              }
            >
              <Route path="" element={<ManageMeetupHomePage />} />
              <Route path="checkin" element={<CheckInPage />} />
              <Route path="raffle" element={<RafflePage />} />
              <Route path="display" element={<ManageMeetupDisplayPage />} />
              <Route path="attendees" element={<ManageMeetupAttendeesPage />} />
              <Route path="settings" element={<ManageMeetupSettingsPage />} />
            </Route>
            <Route
              path="/meetup/:meetupId/display"
              element={
                <RequireMeetup>
                  <MeetupDisplayPage />
                </RequireMeetup>
              }
            />
            <Route
              path="/account/authorize-eventbrite"
              element={
                <RequireAuth>
                  <AuthorizeEventbritePage />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminPage>
                    <Outlet />
                  </AdminPage>
                </RequireAdmin>
              }
            >
              <Route path="" element={<AdminRequestsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
            </Route>
          </Routes>
        </Router>
      </Provider>
    </TooltipProvider>
  );
};

export default App;
