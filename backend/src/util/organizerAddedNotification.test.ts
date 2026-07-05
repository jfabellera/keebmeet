/// <reference types="jest" />

// ---- Mocks -----------------------------------------------------------------

jest.mock('../config', () => ({
  __esModule: true,
  default: {
    webUrl: 'https://app.test',
  },
}));

jest.mock('../entity/User', () => ({
  User: {
    find: jest.fn(),
  },
}));

jest.mock('./email', () => ({
  __esModule: true,
  sendOrganizerAddedEmail: jest.fn(),
}));

import { notifyAddedOrganizers } from './organizerAddedNotification';
import { User } from '../entity/User';
import { sendOrganizerAddedEmail } from './email';
import { In } from 'typeorm';

const mockedUser = jest.mocked(User);
const mockedSendEmail = jest.mocked(sendOrganizerAddedEmail);

const fakeUser = (overrides: Record<string, unknown> = {}): any => ({
  id: '1',
  email: 'user@example.com',
  nick_name: 'jane',
  is_verified: true,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notifyAddedOrganizers', () => {
  it('emails each added organizer with the meetup name, lead, and manage link', async () => {
    mockedUser.find.mockResolvedValue([
      fakeUser({ id: '10', email: 'org1@example.com' }),
      fakeUser({ id: '11', email: 'org2@example.com' }),
    ]);

    await notifyAddedOrganizers(['10', '11'], '42', 'Keeb Night', 'Lead Larry');

    // Only verified users are queried.
    expect(mockedUser.find).toHaveBeenCalledWith({
      where: { id: In(['10', '11']), is_verified: true },
    });
    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    expect(mockedSendEmail).toHaveBeenCalledWith(
      'org1@example.com',
      'Keeb Night',
      'Lead Larry',
      'https://app.test/meetup/42/manage'
    );
    expect(mockedSendEmail).toHaveBeenCalledWith(
      'org2@example.com',
      'Keeb Night',
      'Lead Larry',
      'https://app.test/meetup/42/manage'
    );
  });

  it('does nothing (and skips the query) when no organizers were added', async () => {
    await notifyAddedOrganizers([], '42', 'Keeb Night', 'Lead Larry');

    expect(mockedUser.find).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('sends nothing when none of the added organizers are verified', async () => {
    // The is_verified filter is applied in the query, so an unverified-only
    // set comes back empty.
    mockedUser.find.mockResolvedValue([]);

    await notifyAddedOrganizers(['10'], '42', 'Keeb Night', 'Lead Larry');

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});
