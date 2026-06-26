// Require the necessary discord.js classes
import {
  ActionRowBuilder,
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
const backendUrl = process.env.MMS_API_URL;
const internalApiSecret = process.env.INTERNAL_API_SECRET;
if (!backendUrl || !internalApiSecret) {
  throw new Error(
    'MMS_API_URL and INTERNAL_API_SECRET must be set. See bot/.env.example.'
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
        meetup_id: Number(meetupId),
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

    // Already RSVP'd: offer an ephemeral confirm button rather than cancelling.
    if (status === 'already') {
      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`rsvp-cancel:${meetupId}`)
          .setLabel('Cancel RSVP')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        content:
          "You're already RSVP'd to this meetup. Press **Cancel RSVP** to cancel it.",
        components: [confirmRow],
      });
      return;
    }

    // Any terminal status: replace the message and clear the confirm button.
    await interaction.editReply({
      content:
        RSVP_MESSAGES[status] ?? 'Something went wrong. Please try again.',
      components: [],
    });

    // Send a DM to confirm the RSVP or cancellation.
    try {
      const dm = await interaction.user.createDM();
      const linkText = messageUrl
        ? `\n\n[View meetup announcement](${messageUrl})`
        : '';

      if (status === 'created') {
        const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`rsvp-cancel:${meetupId}`)
            .setLabel('Cancel RSVP')
            .setStyle(ButtonStyle.Danger)
        );

        await dm.send({
          content: `✅ You're RSVP'd for **${meetupName}**! If you need to cancel, use the button below.${linkText}`,
          components: [cancelRow],
        });
      } else if (status === 'cancelled') {
        const rsvpAgainText = messageUrl
          ? `You can RSVP again from the [meetup announcement](${messageUrl}).`
          : 'You can RSVP again from the meetup announcement.';

        await dm.send({
          content: `Your RSVP for **${meetupName}** has been cancelled. ${rsvpAgainText}`,
        });
      }
    } catch (error) {
      // DMs may be disabled — don't let that break the flow.
      console.warn('Could not send RSVP DM:', error);
    }
  })();
});

// Log in to Discord with your client's token
client.login(token);
