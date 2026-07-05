import { type Request, type Response } from 'express';
import { type User } from '../entity/User';
import {
  getEventbriteEvents,
  getEventbriteOrganizations,
  getEventbriteQuestions,
  getEventbriteTickets,
} from '../util/eventbriteApi';
import { decrypt } from '../util/security';

const rejectNoToken = (res: Response): Response => {
  return res
    .status(400)
    .json({ message: 'No Eventbrite access token tied to user.' });
};

export const getEventbriteOrganizationsEndpoint = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const user = res.locals.requestor as User;

  if (user.encrypted_eventbrite_token == null) return rejectNoToken(res);

  try {
    const ebToken = decrypt(user.encrypted_eventbrite_token);
    const organizations = await getEventbriteOrganizations(ebToken);

    return res.status(200).json(organizations);
  } catch (error: any) {
    return res.status(500).json({ message: 'Unable to get organizations.' });
  }
};

export const getEventbriteEventsEndpoint = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { organization_id } = req.params as Record<string, string>;
  const user = res.locals.requestor as User;

  if (user.encrypted_eventbrite_token == null) return rejectNoToken(res);

  try {
    const ebToken = decrypt(user.encrypted_eventbrite_token);
    const events = await getEventbriteEvents(ebToken, organization_id);

    return res.status(200).json(events);
  } catch (error: any) {
    return res.status(500).json({ message: 'Unable to get events.' });
  }
};

export const getEventbriteTicketsEndpoint = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { event_id } = req.params as Record<string, string>;
  const user = res.locals.requestor as User;

  if (user.encrypted_eventbrite_token == null) return rejectNoToken(res);

  try {
    const ebToken = decrypt(user.encrypted_eventbrite_token);
    const tickets = await getEventbriteTickets(ebToken, event_id);

    return res.status(200).json(tickets);
  } catch (error: any) {
    return res.status(500).json({ message: 'Unable to get ticket classes.' });
  }
};

export const getEventbriteQuestionsEndpoint = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { event_id } = req.params as Record<string, string>;
  const user = res.locals.requestor as User;

  if (user.encrypted_eventbrite_token == null) return rejectNoToken(res);

  try {
    const ebToken = decrypt(user.encrypted_eventbrite_token);
    const questions = await getEventbriteQuestions(ebToken, event_id);

    return res.status(200).json(questions);
  } catch (error: any) {
    return res.status(500).json({ message: 'Unable to get custom questions.' });
  }
};
