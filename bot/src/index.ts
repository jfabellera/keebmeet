// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits } from 'discord.js';

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

// Maps the backend's RSVP status to the message shown to the user.
const RSVP_MESSAGES: Record<string, string> = {
  created: "✅ You're RSVP'd!",
  cancelled: 'Your RSVP has been cancelled.',
  full: 'Sorry, this meetup is full.',
  ended: 'This meetup has already happened.',
};

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Handle RSVP button clicks on meetup announcement embeds.
client.on(Events.InteractionCreate, (interaction) => {
  void (async () => {
    if (!interaction.isButton()) return;

    const [action, meetupId] = interaction.customId.split(':');
    if (action !== 'rsvp') return;

    await interaction.deferReply({ ephemeral: true });

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
          display_name:
            interaction.user.globalName ?? interaction.user.username,
        }),
      });

      const data = (await response.json()) as { status?: string };
      await interaction.editReply(
        RSVP_MESSAGES[data.status ?? ''] ?? 'Something went wrong.'
      );
    } catch (error) {
      console.error('Failed to record Discord RSVP:', error);
      await interaction.editReply('Something went wrong. Please try again.');
    }
  })();
});

// Log in to Discord with your client's token
client.login(token);
