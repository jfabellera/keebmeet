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
  sendOrganizerRequestEmail: jest.fn(),
}));

import { notifyAdminsOfOrganizerRequest } from './organizerRequestNotification';
import { User } from '../entity/User';
import { sendOrganizerRequestEmail } from './email';

const mockedUser = jest.mocked(User);
const mockedSendEmail = jest.mocked(sendOrganizerRequestEmail);

const fakeUser = (overrides: Record<string, unknown> = {}): any => ({
  id: 1,
  email: 'user@example.com',
  nick_name: 'jane',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notifyAdminsOfOrganizerRequest', () => {
  it('emails every admin with the requester details and review link', async () => {
    mockedUser.find.mockResolvedValue([
      fakeUser({ id: 10, email: 'admin1@example.com' }),
      fakeUser({ id: 11, email: 'admin2@example.com' }),
    ]);
    const requester = fakeUser({
      email: 'requester@example.com',
      nick_name: 'newbie',
    });

    await notifyAdminsOfOrganizerRequest(requester);

    expect(mockedUser.find).toHaveBeenCalledWith({
      where: { is_admin: true },
    });
    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    expect(mockedSendEmail).toHaveBeenCalledWith(
      'admin1@example.com',
      'newbie',
      'requester@example.com',
      'https://app.test/admin'
    );
    expect(mockedSendEmail).toHaveBeenCalledWith(
      'admin2@example.com',
      'newbie',
      'requester@example.com',
      'https://app.test/admin'
    );
  });

  it('sends nothing when there are no admins', async () => {
    mockedUser.find.mockResolvedValue([]);

    await notifyAdminsOfOrganizerRequest(fakeUser());

    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});
