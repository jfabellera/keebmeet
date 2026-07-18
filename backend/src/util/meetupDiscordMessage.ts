import config from '../config';
import { Meetup } from '../entity/Meetup';
import { Ticket } from '../entity/Ticket';
import { publicUrl } from './objectStorage';
import {
  editEmbedMessage,
  type DiscordComponent,
  type DiscordEmbed,
} from './discord';

// Discord component types.
const ACTION_ROW = 1;
const BUTTON = 2;
const BUTTON_STYLE_PRIMARY = 1;
const BUTTON_STYLE_LINK = 5;

/**
 * Builds the action row holding the meetup announcement's button.
 *
 * When `allowRsvp` is true the button is an interactive RSVP button whose
 * custom_id encodes the meetup id, so the bot can route the click without an
 * extra lookup. When false it is a link button that sends people to the
 * meetup's web page to sign up online.
 */
export const buildMeetupComponents = (
  meetup: Meetup,
  allowRsvp: boolean
): DiscordComponent[] => {
  const meetupUrl = `${config.webUrl}/meetup/${meetup.slug}`;

  // The interactive RSVP button doesn't link anywhere, so add a link button.
  const components: DiscordComponent[] = allowRsvp
    ? [
        {
          type: BUTTON,
          style: BUTTON_STYLE_PRIMARY,
          label: 'RSVP',
          custom_id: `rsvp:${meetup.id}`,
        },
        {
          type: BUTTON,
          style: BUTTON_STYLE_LINK,
          label: 'View on KeebMeet',
          url: meetupUrl,
        },
      ]
    : [
        {
          type: BUTTON,
          style: BUTTON_STYLE_LINK,
          label: 'RSVP on KeebMeet',
          url: meetupUrl,
        },
      ];

  return [{ type: ACTION_ROW, components }];
};

// Discord caps an embed field value at 1024 characters.
const FIELD_VALUE_LIMIT = 1024;

/**
 * Returns the display names of a meetup's attendees, oldest RSVP first.
 */
export const getMeetupAttendeeDisplayNames = async (
  meetupId: string
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

// Footers are plain text (no links), so this credits organizers by name only.
const buildOrganizersFooter = (
  meetup: Meetup
): { text: string } | undefined => {
  const seen = new Set<string>();
  const names = [meetup.lead_organizer, ...(meetup.organizers ?? [])]
    .filter((organizer) => organizer != null)
    .filter((organizer) => {
      if (seen.has(organizer.id)) return false;
      seen.add(organizer.id);
      return true;
    })
    .map((organizer) => organizer.nick_name);

  if (names.length === 0) return undefined;

  const list =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;

  return { text: `Organized by ${list}` };
};

/**
 * Returns a wsrv.nl proxy URL that crops the image to a 2:1 aspect ratio
 * suitable for Discord embeds
 */
const cropImageUrl = (url: string): string => {
  if (!url) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1200&h=600&fit=cover`;
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
  url: `${config.webUrl}/meetup/${meetup.slug}`,
  image: { url: cropImageUrl(publicUrl(meetup.image_key)) },
  footer: buildOrganizersFooter(meetup),
  fields: [
    {
      name: 'Date',
      value: `<t:${Math.floor(Date.parse(meetup.date) / 1000)}:F>`,
    },
    {
      name: 'Location',
      value: `[${meetup.address}](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        meetup.address
      )})`,
    },
    {
      name: `Attendees (${attendeeNames.length}/${meetup.capacity})`,
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
  meetupId: string
): Promise<void> => {
  try {
    const meetup = await Meetup.findOne({
      relations: { discordMessage: true, lead_organizer: true, organizers: true },
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
      buildMeetupComponents(meetup, meetup.discordMessage.allow_rsvp)
    );
  } catch (error: any) {
    console.error(
      'Failed to refresh meetup Discord message:',
      error.response?.status,
      error.response?.data ?? error.message
    );
  }
};
