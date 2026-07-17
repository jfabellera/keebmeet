import { z } from 'zod';

// URL identifiers. Slug: lowercase alphanumerics separated by single hyphens.
// Username: lowercase alphanumerics and underscores only (snake_case, no
// hyphens), must include a letter (so it can't be mistaken for a numeric id)
// and can't start/end with an underscore.
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9_]*[a-z0-9])?$/;

// Lowercase, hyphen-separated slug from arbitrary text. Returns '' when the
// input has no usable characters (callers decide on a fallback).
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const slugField = z.string().max(120).regex(SLUG_REGEX, 'Invalid URL slug');
const usernameField = z
  .string()
  .min(3)
  .max(30)
  .regex(
    USERNAME_REGEX,
    'Lowercase letters, numbers, and underscores only, and cannot start or end with an underscore'
  )
  .regex(/[a-z]/, 'Username must include a letter');

export const createMeetupSchema = z.object({
  name: z.string().min(3),
  slug: slugField,
  date: z.string().datetime({
    offset: false,
    message: 'Datetime must be in the format of YYYY-MM-DDT:HH:mm:ssZ',
  }),
  address: z.string(),
  duration_hours: z.number().gt(0),
  capacity: z.number().gt(0),
  image_key: z.string(),
  organizer_ids: z.array(z.string()).optional(),
  description: z.string().optional().default(''),
  has_raffle: z.boolean().optional().default(true),
  default_raffle_entries: z.number().gte(0).optional().default(1),
});

export type CreateMeetupPayload = z.infer<typeof createMeetupSchema>;

export const createArchiveMeetupSchema = z.object({
  name: z.string().min(3),
  slug: slugField,
  date: z.string().datetime({
    offset: false,
    message: 'Datetime must be in the format of YYYY-MM-DDT:HH:mm:ssZ',
  }),
  address: z.string(),
  image_key: z.string(),
  description: z.string().optional(),
  // Display-only credit for who ran the meetup. The submitter is always the
  // archive's lead organizer (and owner); omit this when they ran it themselves.
  organizer_name: z.string().max(30).optional(),
});

export type CreateArchiveMeetupPayload = z.infer<
  typeof createArchiveMeetupSchema
>;

export const createMeetupFromEventbriteSchema = z.object({
  eventbrite_event_id: z.string(),
  eventbrite_ticket_id: z.string(),
  eventbrite_question_id: z.string(),
  has_raffle: z.boolean().optional().default(true),
  default_raffle_entries: z.number().gte(0).optional().default(1),
});

export type CreateMeetupFromEventbritePayload = z.infer<
  typeof createMeetupFromEventbriteSchema
>;

export const editMeetupSchema = z.object({
  name: z.string().min(3).optional(),
  slug: slugField.optional(),
  date: z
    .string()
    .datetime({
      offset: false,
      message: 'Datetime must be in the format of YYYY-MM-DDT:HH:mm:ssZ',
    })
    .optional(),
  address: z.string().optional(),
  duration_hours: z.number().gt(0).optional(),
  capacity: z.number().gt(0).optional(),
  image_key: z.string().optional(),
  description: z.string().optional(),
  organizer_ids: z.array(z.string()).optional(),
  organizer_name: z.string().max(30).optional(),
  has_raffle: z.boolean().optional(),
  default_raffle_entries: z.number().gte(0).optional(),
  display_idle_image_urls: z.string().array().optional(),
  display_raffle_background_url: z
    .string()
    .transform((string) => (string === '' ? null : string))
    .optional(),
  display_batch_raffle_background_url: z
    .string()
    .transform((string) => (string === '' ? null : string))
    .optional(),
});

export type EditMeetupPayload = z.infer<typeof editMeetupSchema>;

export const transferMeetupSchema = z.object({
  new_lead_organizer_id: z.string(),
});

export type TransferMeetupPayload = z.infer<typeof transferMeetupSchema>;

export const createMeetupDiscordMessageSchema = z.object({
  server_id: z.string(),
  channel_id: z.string(),
  allow_rsvp: z.boolean().default(false),
});

export type CreateMeetupDiscordMessagePayload = z.infer<
  typeof createMeetupDiscordMessageSchema
>;

export const updateMeetupDiscordMessageSchema = z.object({
  allow_rsvp: z.boolean().optional(),
});

export type UpdateMeetupDiscordMessagePayload = z.infer<
  typeof updateMeetupDiscordMessageSchema
>;

export const discordRsvpSchema = z.object({
  meetup_id: z.string(),
  discord_id: z.string(),
  display_name: z.string(),
  // 'rsvp' creates (or reports an existing RSVP); 'cancel' removes it. Cancelling
  // is a separate, explicit action so the bot can ask the user to confirm.
  action: z.enum(['rsvp', 'cancel']),
});

export type DiscordRsvpPayload = z.infer<typeof discordRsvpSchema>;

// Shared by create and edit: when a ticket holder is provided, every field is
// required so we never persist a half-populated holder.
const ticketHolderSchema = z.object({
  display_name: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.email(),
});

export const createTicketSchema = z.object({
  ticket_holder: ticketHolderSchema.optional(),
});

export type CreateTicketPayload = z.infer<typeof createTicketSchema>;

export const editTicketSchema = z.object({
  is_checked_in: z.boolean().optional(),
  raffle_entries: z.number().min(0).optional(),
  raffle_wins: z.number().min(0).optional(),
  ticket_holder: ticketHolderSchema.optional(),
});

export type EditTicketPayload = z.infer<typeof editTicketSchema>;

export const createGallerySchema = z.object({
  gallery: z.url().max(1024),
  contributor_name: z.string().max(30).optional(),
});

export type CreateGalleryPayload = z.infer<typeof createGallerySchema>;

export const createUserSchema = z.object({
  email: z.email(),
  first_name: z.string(),
  last_name: z.string(),
  nick_name: z.string(),
  username: usernameField,
  password: z.string(), // TODO(jan): check for password strength?
  is_organizer_requested: z.boolean().optional().default(false),
  // Optional R2 key of a profile photo uploaded before registration.
  photo_key: z.string().optional(),
  // Cloudflare Turnstile token, verified server-side to block bot signups.
  turnstile_token: z.string().min(1, 'Captcha verification is required'),
});

export type CreateUserPayload = z.infer<typeof createUserSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'A verification token is required'),
});

export type VerifyEmailPayload = z.infer<typeof verifyEmailSchema>;

export const editUserSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  nick_name: z.string().optional(),
  username: usernameField.optional(),
  password: z.string().optional(), // TODO(jan): check for password strength?
  is_organizer: z.boolean().optional(),
  is_admin: z.boolean().optional(),
  // R2 key of a newly uploaded profile photo, or '' to remove the current one.
  photo_key: z.string().optional(),
  // The requestor's own password, required to confirm a change to is_admin.
  current_password: z.string().optional(),
});

export type EditUserPayload = z.infer<typeof editUserSchema>;

export const rollRaffleWinnerSchema = z.object({
  quantity: z.number().gt(0).optional().default(1),
  allIn: z.boolean().optional().default(false),
  includeNotCheckedIn: z.boolean().optional().default(false),
});

export type RollRaffleWinnerPayload = z.input<typeof rollRaffleWinnerSchema>;

export const claimRaffleWinnerSchema = z.object({
  raffleRecordId: z.string(),
  force: z.boolean().default(false).optional(),
});

export type ClaimRaffleWinnerPayload = z.input<typeof claimRaffleWinnerSchema>;

export const unclaimRaffleWinnerSchema = z.object({
  ticketId: z.string(),
});

export type UnclaimRaffleWinnerPayload = z.input<
  typeof unclaimRaffleWinnerSchema
>;
