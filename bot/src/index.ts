// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits } from 'discord.js';

// Read the bot token from the environment. Never hard-code it or commit it to
// source control. Locally it comes from a gitignored `.env` file (loaded via
// `node --env-file=.env`); in production set DISCORD_TOKEN in your secret store.
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  throw new Error(
    'DISCORD_TOKEN is not set. Add it to bot/.env (see .env.example).'
  );
}

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
client.login(token);
