import { type Request, type Response } from 'express';
import { socket } from '../Server';
import { Meetup } from '../entity/Meetup';
import { MeetupDiscordMessage } from '../entity/MeetupDiscordMessage';
import { Ticket } from '../entity/Ticket';
import { User } from '../entity/User';
import { refreshMeetupDiscordMessage } from '../util/meetupDiscordMessage';
import { generateQrCodeBuffer } from '../util/qrCode';
import { getMeetupEnd, isMeetupAtCapacity } from '../util/rsvp';
import { discordRsvpSchema } from '@keebmeet/shared';

/**
 * Handles a Discord user's RSVP action for a meetup, called by the bot when an
 * RSVP/cancel button is clicked. RSVPing ties the ticket to the Discord user
 * (and to their app account if one is linked by discord_id). Cancelling is a
 * separate action so the bot can confirm with the user first.
 *
 * Responds with a `status` the bot maps to an ephemeral reply:
 * 'created' | 'already' | 'cancelled' | 'not_found' | 'full' | 'ended' |
 * 'disabled'.
 */
export const handleDiscordRsvp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = discordRsvpSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const { meetup_id, discord_id, display_name, action } = result.data;
  // meetup_id arrives as a number from the zod payload; ids are string in the DB.
  const meetupId = String(meetup_id);

  const meetup = await Meetup.findOneBy({ id: meetupId });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  const discordMsg = await MeetupDiscordMessage.findOneBy({
    meetup: { id: meetupId },
  });
  const messageUrl = discordMsg
    ? `https://discord.com/channels/${discordMsg.guild_id}/${discordMsg.channel_id}/${discordMsg.message_id}`
    : null;

  // Link to an app account if one is registered with this Discord id.
  const user = await User.findOneBy({ discord_id });

  const existingTicket = await Ticket.findOne({
    relations: { user: true },
    where: [
      { meetup: { id: meetupId }, discord_id },
      ...(user != null
        ? [{ meetup: { id: meetupId }, user: { id: user.id } }]
        : []),
    ],
  });

  if (action === 'cancel') {
    if (existingTicket == null) {
      return res.json({ status: 'not_found' });
    }

    if (getMeetupEnd(meetup) < new Date()) {
      return res.json({ status: 'ended' });
    }

    await existingTicket.remove();
    socket.emit('meetup:update', { meetupId: meetup_id });
    await refreshMeetupDiscordMessage(meetupId);
    return res.json({
      status: 'cancelled',
      meetup_name: meetup.name,
      message_url: messageUrl,
    });
  }

  // action === 'rsvp'
  // Defensive: this meetup's announcement opted out of Discord RSVPs, so it
  // should only carry a link button. Reject in case a stale RSVP button is
  // clicked rather than silently creating a ticket.
  if (discordMsg != null && !discordMsg.allow_rsvp) {
    return res.json({ status: 'disabled', message_url: messageUrl });
  }

  if (existingTicket != null) {
    // Re-send the existing ticket's QR code so the bot can re-deliver it (e.g.
    // if the original confirmation DM couldn't reach a user with DMs disabled).
    const qrCode = (await generateQrCodeBuffer(existingTicket.id)).toString(
      'base64'
    );
    return res.json({
      status: 'already',
      meetup_name: meetup.name,
      message_url: messageUrl,
      qr_code: qrCode,
    });
  }

  if (getMeetupEnd(meetup) < new Date()) {
    return res.json({ status: 'ended' });
  }

  if (await isMeetupAtCapacity(meetupId, meetup.capacity)) {
    return res.json({ status: 'full' });
  }

  const ticket = Ticket.create({
    meetup,
    user: user ?? null,
    discord_id,
    raffle_entries: meetup.default_raffle_entries,
    ticket_holder_display_name: user?.nick_name ?? display_name,
    ticket_holder_first_name: user?.first_name ?? '',
    ticket_holder_last_name: user?.last_name ?? '',
    ticket_holder_email: user?.email ?? '',
  });
  await ticket.save();

  socket.emit('meetup:update', { meetupId: meetup_id });
  await refreshMeetupDiscordMessage(meetupId);

  // Base64-encoded PNG the bot attaches to its confirmation DM, mirroring the
  // QR code the email RSVP flow sends. The HMAC secret stays in the backend.
  const qrCode = (await generateQrCodeBuffer(ticket.id)).toString('base64');

  return res.status(201).json({
    status: 'created',
    meetup_name: meetup.name,
    message_url: messageUrl,
    qr_code: qrCode,
  });
};
