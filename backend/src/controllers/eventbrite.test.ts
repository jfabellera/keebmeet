/// <reference types="jest" />
import { type Request, type Response } from 'express';

// ---- Mocks -----------------------------------------------------------------

jest.mock('../util/eventbriteApi', () => ({
  getEventbriteOrganizations: jest.fn(),
  getEventbriteEvents: jest.fn(),
  getEventbriteTickets: jest.fn(),
  getEventbriteQuestions: jest.fn(),
}));

jest.mock('../util/security', () => ({
  decrypt: jest.fn((value: string) => `decrypted(${value})`),
}));

import {
  getEventbriteEventsEndpoint,
  getEventbriteOrganizationsEndpoint,
  getEventbriteQuestionsEndpoint,
  getEventbriteTicketsEndpoint,
} from './eventbrite';
import {
  getEventbriteEvents,
  getEventbriteOrganizations,
  getEventbriteQuestions,
  getEventbriteTickets,
} from '../util/eventbriteApi';
import { decrypt } from '../util/security';

const mockedOrgs = jest.mocked(getEventbriteOrganizations);
const mockedEvents = jest.mocked(getEventbriteEvents);
const mockedTickets = jest.mocked(getEventbriteTickets);
const mockedQuestions = jest.mocked(getEventbriteQuestions);
const mockedDecrypt = jest.mocked(decrypt);

// ---- Helpers ---------------------------------------------------------------

type MockResponse = Response & { statusCode?: number; body?: unknown };

const mockResponse = (): MockResponse => {
  const res: any = {};
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.locals = {};
  return res as MockResponse;
};

const mockRequest = (params: Record<string, string> = {}): Request =>
  ({ params }) as unknown as Request;

const withToken = (res: MockResponse): void => {
  res.locals.requestor = { encrypted_eventbrite_token: 'enc' };
};
const withoutToken = (res: MockResponse): void => {
  res.locals.requestor = { encrypted_eventbrite_token: null };
};

beforeEach(() => {
  jest.clearAllMocks();
});

// Each endpoint shares the same contract: reject without a token, decrypt the
// token and proxy on success, and translate upstream failures to a 500.
const cases = [
  {
    name: 'getEventbriteOrganizationsEndpoint',
    fn: getEventbriteOrganizationsEndpoint,
    mock: mockedOrgs,
    params: {},
    errorMessage: 'Unable to get organizations.',
  },
  {
    name: 'getEventbriteEventsEndpoint',
    fn: getEventbriteEventsEndpoint,
    mock: mockedEvents,
    params: { organization_id: '7' },
    errorMessage: 'Unable to get events.',
  },
  {
    name: 'getEventbriteTicketsEndpoint',
    fn: getEventbriteTicketsEndpoint,
    mock: mockedTickets,
    params: { event_id: '42' },
    errorMessage: 'Unable to get ticket classes.',
  },
  {
    name: 'getEventbriteQuestionsEndpoint',
    fn: getEventbriteQuestionsEndpoint,
    mock: mockedQuestions,
    params: { event_id: '42' },
    errorMessage: 'Unable to get custom questions.',
  },
] as const;

describe.each(cases)('$name', ({ fn, mock, params, errorMessage }) => {
  it('returns 400 when the user has no Eventbrite token', async () => {
    const res = mockResponse();
    withoutToken(res);

    await fn(mockRequest(params), res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      message: 'No Eventbrite access token tied to user.',
    });
    expect(mock).not.toHaveBeenCalled();
  });

  it('decrypts the token and returns the upstream payload on success', async () => {
    (mock as jest.Mock).mockResolvedValue([{ id: '1' }]);
    const res = mockResponse();
    withToken(res);

    await fn(mockRequest(params), res);

    expect(mockedDecrypt).toHaveBeenCalledWith('enc');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: '1' }]);
  });

  it('returns 500 when the upstream call throws', async () => {
    (mock as jest.Mock).mockRejectedValue(new Error('upstream down'));
    const res = mockResponse();
    withToken(res);

    await fn(mockRequest(params), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: errorMessage });
  });
});
