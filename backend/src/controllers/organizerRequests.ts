import { type Request, type Response } from 'express';
import { OrganizerRequest } from '../entity/OrganizerRequest';
import { type User } from '../entity/User';
import config from '../config';
import { type OrganizerRequestInfo } from '../interfaces/userInterfaces';
import {
  sendOrganizerApprovedEmail,
  sendOrganizerDeniedEmail,
} from '../util/email';
import { notifyAdminsOfOrganizerRequest } from '../util/organizerRequestNotification';
import { toUserResponse } from '../util/userResponse';

/**
 * Creates a pending organizer request for the authenticated requestor. A user
 * can only request access for themselves; granting is reserved for admins (see
 * {@link approveOrganizerRequest}).
 */
export const createOrganizerRequest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const requestor = res.locals.requestor as User;

  if (requestor.is_organizer) {
    return res
      .status(400)
      .json({ message: 'You are already an organizer.' });
  }

  const existing = await OrganizerRequest.findOne({
    where: { user: { id: requestor.id } },
  });

  if (existing != null) {
    return res
      .status(409)
      .json({ message: 'You already have a pending organizer request.' });
  }

  await OrganizerRequest.create({ user: requestor }).save();

  await notifyAdminsOfOrganizerRequest(requestor);

  return res.status(201).json({ message: 'Organizer request submitted.' });
};

/**
 * Lists all pending organizer requests, oldest first. Admin only.
 */
export const getOrganizerRequests = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const requests = await OrganizerRequest.find({
    relations: { user: true },
    order: { created_at: 'ASC' },
  });

  const response: OrganizerRequestInfo[] = requests.map((request) => ({
    id: request.id,
    created_at: request.created_at.toISOString(),
    user: toUserResponse(request.user),
  }));

  return res.json(response);
};

/**
 * Approves a pending request: grants the user organizer access and removes the
 * request. Admin only.
 */
export const approveOrganizerRequest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { request_id } = req.params as Record<string, string>;

  const request = await OrganizerRequest.findOne({
    relations: { user: true },
    where: { id: parseInt(request_id) },
  });

  if (request == null) {
    return res.status(404).json({ message: 'Invalid request ID.' });
  }

  request.user.is_organizer = true;
  await request.user.save();
  await request.remove();

  // Let the user know they've been approved. Rejections are silent by design.
  await sendOrganizerApprovedEmail(
    request.user.email,
    `${config.webUrl}/organizer`
  );

  return res.status(200).json(toUserResponse(request.user));
};

/**
 * Denies a pending request by removing it. The user keeps their current
 * (non-organizer) access. Admin only.
 */
export const denyOrganizerRequest = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { request_id } = req.params as Record<string, string>;

  const request = await OrganizerRequest.findOne({
    relations: { user: true },
    where: { id: parseInt(request_id) },
  });

  if (request == null) {
    return res.status(404).json({ message: 'Invalid request ID.' });
  }

  const requesterEmail = request.user.email;
  await request.remove();

  // Let the user know their request was reviewed and not approved.
  await sendOrganizerDeniedEmail(requesterEmail);

  return res.status(204).end();
};
