// Require the necessary discord.js classes
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  type ButtonInteraction,
} from 'discord.js';

// Read the bot token from the environment. Never hard-code it or commit it to
// source control. Locally it comes from a gitignored `.env` file (loaded via
// `node --env-file=.env`); in production set DISCORD_BOT_TOKEN in your secret store.
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  throw new Error(
    'DISCORD_BOT_TOKEN is not set. Add it to bot/.env (see .env.example).'
  );
}

// The backend the bot calls to record RSVPs, and the shared secret that
// authenticates those calls. Both come from the environment.
const backendUrl = process.env.KEEBMEET_API_URL;
const internalApiSecret = process.env.INTERNAL_API_SECRET;
if (!backendUrl || !internalApiSecret) {
  throw new Error(
    'KEEBMEET_API_URL and INTERNAL_API_SECRET must be set. See bot/.env.example.'
  );
}

// Maps a terminal backend RSVP status to the message shown to the user. The
// 'already' status is handled separately because it offers a confirm button.
const RSVP_MESSAGES: Record<string, string> = {
  created: "✅ You're RSVP'd!",
  cancelled: 'Your RSVP has been cancelled.',
  not_found: "You don't have an RSVP to cancel.",
  full: 'Sorry, this meetup is full.',
  ended: 'This meetup has already happened.',
};

interface RsvpResponse {
  status?: string;
  meetup_name?: string;
  message_url?: string;
  // Base64-encoded PNG of the RSVP's QR code, present on a 'created' response.
  qr_code?: string;
}

// Calls the backend to record an RSVP action and returns the response object,
// or a fallback with status 'error' if the call fails.
const postRsvp = async (
  meetupId: string,
  interaction: ButtonInteraction,
  action: 'rsvp' | 'cancel'
): Promise<RsvpResponse> => {
  try {
    const response = await fetch(`${backendUrl}/discord/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': internalApiSecret,
      },
      body: JSON.stringify({
        meetup_id: meetupId,
        discord_id: interaction.user.id,
        display_name: interaction.user.globalName ?? interaction.user.username,
        action,
      }),
    });

    return (await response.json()) as RsvpResponse;
  } catch (error) {
    console.error('Failed to record Discord RSVP:', error);
    return { status: 'error' };
  }
};

// The red "Cancel RSVP" button we attach to confirmation replies/DMs. Its
// custom_id is handled by the same interaction listener (action `rsvp-cancel`).
const cancelRow = (meetupId: string): ActionRowBuilder<ButtonBuilder> =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`rsvp-cancel:${meetupId}`)
      .setLabel('Cancel RSVP')
      .setStyle(ButtonStyle.Danger)
  );

// The note appended to the ephemeral confirmation about the QR code: point the
// user to their DM copy if one was delivered, otherwise nudge them to save it
// since the ephemeral reply can be dismissed.
const qrNote = (dmDelivered: boolean): string =>
  dmDelivered
    ? '\n\nIf asked, present this QR code at the event. A copy has been sent to your DMs.'
    : "\n\nSave your QR code in case it's needed — this message can be dismissed.";

// Wraps the QR code (a base64 PNG from the backend) as a discord.js attachment
// so it displays inline, mirroring the email RSVP flow. Empty when there's no
// QR code, so it can be spread into any message's `files`.
const qrAttachment = (qrCode: string | undefined): AttachmentBuilder[] =>
  qrCode
    ? [
        new AttachmentBuilder(Buffer.from(qrCode, 'base64'), {
          name: 'qr-code.png',
        }),
      ]
    : [];

// DMs the user a durable copy of their RSVP confirmation with the QR code
// attached. Throws if the DM can't be delivered — e.g. the user's privacy
// settings block direct messages from this server (DiscordAPIError 50007) — so
// callers can decide how to handle that.
const sendQrDm = async (
  interaction: ButtonInteraction,
  content: string,
  qrCode: string | undefined
): Promise<void> => {
  const dm = await interaction.user.createDM();
  await dm.send({ content, files: qrAttachment(qrCode) });
};

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Handle RSVP button clicks on meetup announcement embeds. The embed's primary
// button uses custom_id `rsvp:<meetupId>`; the confirm-cancel button we send in
// an ephemeral reply uses `rsvp-cancel:<meetupId>`.
client.on(Events.InteractionCreate, (interaction) => {
  void (async () => {
    if (!interaction.isButton()) return;

    const [action, meetupId] = interaction.customId.split(':');
    if ((action !== 'rsvp' && action !== 'rsvp-cancel') || meetupId == null) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const rsvpResponse = await postRsvp(
      meetupId,
      interaction,
      action === 'rsvp-cancel' ? 'cancel' : 'rsvp'
    );

    const status = rsvpResponse.status ?? 'error';
    const meetupName = rsvpResponse.meetup_name ?? 'the meetup';
    const messageUrl = rsvpResponse.message_url;
    const qrCode = rsvpResponse.qr_code;

    // Cancelling is done by pressing RSVP again on the announcement (the
    // 'already' path then offers a Cancel button), so tell the user that here.
    const cancelHint = messageUrl
      ? `\n\nTo cancel, press **RSVP** again on the [meetup announcement](${messageUrl}).`
      : '\n\nTo cancel, press **RSVP** again on the meetup announcement.';

    // Already RSVP'd: just re-show the QR code in the confirmation reply with a
    // cancel button — no DM. Since this reply can be dismissed, tell them to
    // save it.
    if (status === 'already') {
      await interaction.editReply({
        content: `You're already RSVP'd for **${meetupName}**.${
          qrCode ? qrNote(false) : ''
        }\n\nPress **Cancel RSVP** to cancel it.`,
        components: [cancelRow(meetupId)],
        files: qrAttachment(qrCode),
      });
      return;
    }

    // A newly created RSVP: DM a durable copy of the QR code, then show it in
    // the confirmation reply. Whether the DM landed decides if we point the
    // user to their DMs or tell them to save it (this reply can be dismissed).
    if (status === 'created') {
      let dmDelivered = false;
      try {
        await sendQrDm(
          interaction,
          `✅ You're RSVP'd for **${meetupName}**! Keep this QR code for the event.${cancelHint}`,
          qrCode
        );
        dmDelivered = true;
      } catch (error) {
        console.warn('Could not send RSVP DM:', error);
      }

      await interaction.editReply({
        content: `✅ You're RSVP'd for **${meetupName}**!${
          qrCode ? qrNote(dmDelivered) : ''
        }${cancelHint}`,
        files: qrAttachment(qrCode),
      });
      return;
    }

    // Any other terminal status: replace the message and clear the button.
    await interaction.editReply({
      content:
        RSVP_MESSAGES[status] ?? 'Something went wrong. Please try again.',
      components: [],
    });

    // A cancellation: the ephemeral reply already confirms it, so a failed DM
    // here is harmless — just log it.
    if (status === 'cancelled') {
      try {
        const dm = await interaction.user.createDM();
        const rsvpAgainText = messageUrl
          ? `You can RSVP again from the [meetup announcement](${messageUrl}).`
          : 'You can RSVP again from the meetup announcement.';

        await dm.send({
          content: `Your RSVP for **${meetupName}** has been cancelled. ${rsvpAgainText}`,
        });
      } catch (error) {
        console.warn('Could not send RSVP DM:', error);
      }
    }
  })();
});

// Log in to Discord with your client's token
client.login(token);
