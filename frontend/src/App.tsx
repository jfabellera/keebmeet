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
import { TooltipProvider } from './components/ui/tooltip';
import AccountPage from './pages/AccountPage';
import AuthorizeEventbritePage from './pages/AuthorizeEventbritePage';
import DiscordCallbackPage from './pages/DiscordCallbackPage';
import DiscordLinkPage from './pages/DiscordLinkPage';
import MeetupDisplayPage from './pages/MeetupDisplayPage';
import MeetupRsvpPage from './pages/MeetupRsvpPage';
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/auth/discord/callback"
              element={<DiscordCallbackPage />}
            />
            <Route path="/auth/discord/link" element={<DiscordLinkPage />} />
            <Route path="/meetup/:meetupId/rsvp" element={<MeetupRsvpPage />} />
            <Route path="/organizer" element={<OrganizerDashboard />} />
            <Route path="/new-meetup" element={<NewMeetupPage />} />
            <Route
              path="/new-meetup/eventbrite"
              element={<NewMeetupFromEventbritePage />}
            />
            <Route
              path="/meetup/:meetupId/manage/"
              element={
                <ManageMeetupPage>
                  <Outlet />
                </ManageMeetupPage>
              }
            >
              <Route path="" element={<ManageMeetupHomePage />} />
              <Route path="checkin" element={<CheckInPage />} />
              <Route path="raffle" element={<RafflePage />} />
              <Route path="attendees" element={<ManageMeetupAttendeesPage />} />
              <Route path="settings" element={<ManageMeetupSettingsPage />} />
            </Route>
            <Route
              path="/meetup/:meetupId/display"
              element={<MeetupDisplayPage />}
            />
            <Route
              path="/account/authorize-eventbrite"
              element={<AuthorizeEventbritePage />}
            />
            <Route path="/account" element={<AccountPage />} />
          </Routes>
        </Router>
      </Provider>
    </TooltipProvider>
  );
};

export default App;
