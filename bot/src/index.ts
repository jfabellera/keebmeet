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

// Calls the backend to record an RSVP action and returns its status string
// ('created' | 'already' | 'cancelled' | 'not_found' | 'full' | 'ended'), or
// 'error' if the call fails.
const postRsvp = async (
  meetupId: string,
  interaction: ButtonInteraction,
  action: 'rsvp' | 'cancel'
): Promise<string> => {
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

    const data = (await response.json()) as { status?: string };
    return data.status ?? 'error';
  } catch (error) {
    console.error('Failed to record Discord RSVP:', error);
    return 'error';
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

    const status = await postRsvp(
      meetupId,
      interaction,
      action === 'rsvp-cancel' ? 'cancel' : 'rsvp'
    );

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
      content: RSVP_MESSAGES[status] ?? 'Something went wrong. Please try again.',
      components: [],
    });
  })();
});

// Log in to Discord with your client's token
client.login(token);
