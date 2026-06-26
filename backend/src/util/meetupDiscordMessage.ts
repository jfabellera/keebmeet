import config from '../config';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import {
  editEmbedMessage,
  type DiscordComponent,
  type DiscordEmbed,
} from './discord';

// Discord component types.
const ACTION_ROW = 1;
const BUTTON = 2;
const BUTTON_STYLE_PRIMARY = 1;

/**
 * Builds the action row holding the RSVP button for a meetup. The custom_id
 * encodes the meetup id so the bot can route the click without an extra lookup.
 */
export const buildRsvpComponents = (meetupId: number): DiscordComponent[] => [
  {
    type: ACTION_ROW,
    components: [
      {
        type: BUTTON,
        style: BUTTON_STYLE_PRIMARY,
        label: 'RSVP',
        custom_id: `rsvp:${meetupId}`,
      },
    ],
  },
];

// Discord caps an embed field value at 1024 characters.
const FIELD_VALUE_LIMIT = 1024;

/**
 * Returns the display names of a meetup's attendees, oldest RSVP first.
 */
export const getMeetupAttendeeDisplayNames = async (
  meetupId: number
): Promise<string[]> => {
  const tickets = await Ticket.find({
    where: { meetup: { id: meetupId } },
    select: { ticket_holder_display_name: true },
    order: { created_at: 'ASC' },
  });

  return tickets
    .map((ticket) => ticket.ticket_holder_display_name)
    .filter((name) => name !== '');
};

/**
 * Builds the attendees field value, listing names one per line until the field
 * limit is reached, then appending "…and N more" for the remainder.
 */
const buildAttendeesValue = (names: string[]): string => {
  if (names.length === 0) {
    return 'No attendees yet.';
  }

  const lines: string[] = [];
  for (let i = 0; i < names.length; i++) {
    const tentative = [...lines, names[i]];
    const remainingAfter = names.length - tentative.length;
    const suffix = remainingAfter > 0 ? `\n…and ${remainingAfter} more` : '';

    if (tentative.join('\n').length + suffix.length > FIELD_VALUE_LIMIT) {
      const more = names.length - lines.length;
      return lines.length === 0
        ? `…and ${more} more`
        : `${lines.join('\n')}\n…and ${more} more`;
    }

    lines.push(names[i]);
  }

  return lines.join('\n');
};

/**
 * Builds the meetup announcement embed from the meetup and its attendees.
 */
export const buildMeetupEmbed = (
  meetup: Meetup,
  attendeeNames: string[]
): DiscordEmbed => ({
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
    {
      name: `Attendees (${attendeeNames.length})`,
      value: buildAttendeesValue(attendeeNames),
    },
  ],
});

/**
 * Re-renders a meetup's tracked Discord embed to reflect the current meetup
 * details and attendee list. No-op when the meetup has no tracked message.
 * Never throws — a Discord failure must not break the triggering request (e.g.
 * an RSVP), so failures are logged and swallowed.
 */
export const refreshMeetupDiscordMessage = async (
  meetupId: number
): Promise<void> => {
  try {
    const meetup = await Meetup.findOne({
      relations: { discordMessage: true },
      where: { id: meetupId },
    });

    if (meetup?.discordMessage == null) {
      return;
    }

    const attendeeNames = await getMeetupAttendeeDisplayNames(meetupId);

    await editEmbedMessage(
      meetup.discordMessage.channel_id,
      meetup.discordMessage.message_id,
      buildMeetupEmbed(meetup, attendeeNames),
      buildRsvpComponents(meetupId)
    );
  } catch (error: any) {
    console.error(
      'Failed to refresh meetup Discord message:',
      error.response?.status,
      error.response?.data ?? error.message
    );
  }
};
