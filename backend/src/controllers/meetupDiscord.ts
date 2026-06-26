import { type Request, type Response } from 'express';
import config from '../config';
import { Meetup } from '../entity/Meetup';
import { MeetupDiscordMessage } from '../entity/MeetupDiscordMessage';
import { User } from '../entity/User';
import {
  createEmbedMessage,
  deleteEmbedMessage,
  editEmbedMessage,
  isGuildMember,
  type DiscordEmbed,
} from '../util/discord';
import { createMeetupDiscordMessageSchema } from '../util/validator';

const buildMeetupEmbed = (meetup: Meetup): DiscordEmbed => ({
  title: meetup.name,
  description: meetup.description,
  url: `${config.webUrl}/meetup/${meetup.id}`,
  image: { url: meetup.image_url },
  fields: [
    {
      name: 'Date',
      value: `<t:${Math.floor(Date.parse(meetup.date) / 1000)}:F>`,
    },
    { name: 'Location', value: meetup.address },
  ],
});

const findMeetupWithMessage = async (
  meetupId: string
): Promise<Meetup | null> =>
  await Meetup.findOne({
    relations: { discordMessage: true },
    where: { id: parseInt(meetupId) },
  });

export const getMeetupDiscordMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const meetup = await findMeetupWithMessage(meetup_id);

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  return res.json(meetup.discordMessage ?? null);
};

export const createMeetupDiscordMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const result = createMeetupDiscordMessageSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const meetup = await findMeetupWithMessage(meetup_id);

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  if (meetup.discordMessage != null) {
    return res
      .status(409)
      .json({ message: 'This meetup already has a Discord message.' });
  }

  // The requestor must be able to post to the chosen server, i.e. they share it
  // with the bot.
  const requestor = res.locals.requestor as User;

  if (requestor.discord_id == null) {
    return res
      .status(409)
      .json({ message: 'You have not linked a Discord account.' });
  }

  if (!(await isGuildMember(result.data.server_id, requestor.discord_id))) {
    return res
      .status(403)
      .json({ message: 'You are not a member of this server.' });
  }

  let messageId: string;
  try {
    messageId = await createEmbedMessage(
      result.data.channel_id,
      buildMeetupEmbed(meetup)
    );
  } catch (error: any) {
    console.error(
      'Failed to create Discord message:',
      error.response?.status,
      error.response?.data ?? error.message
    );
    return res.status(502).json({ message: 'Failed to reach Discord.' });
  }

  const discordMessage = MeetupDiscordMessage.create({
    meetup,
    guild_id: result.data.server_id,
    channel_id: result.data.channel_id,
    message_id: messageId,
  });
  await discordMessage.save();

  return res.status(201).json({
    guild_id: discordMessage.guild_id,
    channel_id: discordMessage.channel_id,
    message_id: discordMessage.message_id,
  });
};

export const updateMeetupDiscordMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const meetup = await findMeetupWithMessage(meetup_id);

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  if (meetup.discordMessage == null) {
    return res
      .status(404)
      .json({ message: 'This meetup has no Discord message.' });
  }

  try {
    await editEmbedMessage(
      meetup.discordMessage.channel_id,
      meetup.discordMessage.message_id,
      buildMeetupEmbed(meetup)
    );
  } catch (error: any) {
    console.error(
      'Failed to edit Discord message:',
      error.response?.status,
      error.response?.data ?? error.message
    );
    return res.status(502).json({ message: 'Failed to reach Discord.' });
  }

  return res.json({
    guild_id: meetup.discordMessage.guild_id,
    channel_id: meetup.discordMessage.channel_id,
    message_id: meetup.discordMessage.message_id,
  });
};

export const deleteMeetupDiscordMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const meetup = await findMeetupWithMessage(meetup_id);

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  if (meetup.discordMessage == null) {
    return res
      .status(404)
      .json({ message: 'This meetup has no Discord message.' });
  }

  try {
    await deleteEmbedMessage(
      meetup.discordMessage.channel_id,
      meetup.discordMessage.message_id
    );
  } catch (error: any) {
    console.error(
      'Failed to delete Discord message:',
      error.response?.status,
      error.response?.data ?? error.message
    );
    return res.status(502).json({ message: 'Failed to reach Discord.' });
  }

  await meetup.discordMessage.remove();

  return res.status(204).send();
};
