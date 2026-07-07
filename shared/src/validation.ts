import { z } from 'zod';

export const createMeetupSchema = z.object({
  name: z.string().min(3),
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

export const createMeetupDiscordMessageSchema = z.object({
  server_id: z.string(),
  channel_id: z.string(),
});

export type CreateMeetupDiscordMessagePayload = z.infer<
  typeof createMeetupDiscordMessageSchema
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

export const createPhotoLinkSchema = z.object({
  photo_link: z.url().max(1024),
});

export type CreatePhotoLinkPayload = z.infer<typeof createPhotoLinkSchema>;

export const createUserSchema = z.object({
  email: z.email(),
  first_name: z.string(),
  last_name: z.string(),
  nick_name: z.string(),
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
