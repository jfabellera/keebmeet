import * as dotenv from 'dotenv';

dotenv.config();

interface Config {
  apiHostname: string;
  apiPort: string;
  authHostname: string;
  authPort: string;
  socketHostname: string;
  socketPort: string;
  databaseHost: string;
  databasePort: string;
  databaseName: string;
  databaseUser: string;
  databasePassword: string;
  jwtSecret: string;
  aesKey: string;
  gcpApiKey: string;
  eventbriteApiKey: string;
  eventbriteClientSecret: string;
  discordClientId: string;
  discordClientSecret: string;
  discordBotToken: string;
  discordRedirectUri: string;
  internalApiSecret: string;
  turnstileSecretKey: string;
  apiUrl: string;
  socketUrl: string;
  webUrl: string;
  r2AccessKeyId: string;
  r2SecretKey: string;
  r2JurisdictionUrl: string;
  r2PublicBaseUrl: string;
}

const config: Config = {
  apiHostname: process.env.KEEBMEET_API_SERVER_HOSTNAME ?? 'localhost',
  apiPort: process.env.KEEBMEET_API_SERVER_PORT ?? '3000',
  authHostname: process.env.KEEBMEET_AUTH_SERVER_HOSTNAME ?? 'localhost',
  authPort: process.env.KEEBMEET_AUTH_SERVER_PORT ?? '3001',
  socketHostname: process.env.KEEBMEET_SOCKET_SERVER_HOSTNAME ?? 'localhost',
  socketPort: process.env.KEEBMEET_SOCKET_SERVER_PORT ?? '3002',
  databaseHost: process.env.KEEBMEET_DATABASE_HOST ?? 'localhost',
  databasePort: process.env.KEEBMEET_DATABASE_PORT ?? '5432',
  databaseName: process.env.KEEBMEET_DATABASE_NAME ?? '',
  databaseUser: process.env.KEEBMEET_DATABASE_USER ?? '',
  databasePassword: process.env.KEEBMEET_DATABASE_PASSWORD ?? '',
  jwtSecret: process.env.JWT_ACCESS_SECRET ?? '',
  aesKey: process.env.AES_ENCRYPTION_KEY ?? '',
  gcpApiKey: process.env.GCP_API_KEY ?? '',
  eventbriteApiKey: process.env.EVENTBRITE_API_KEY ?? '',
  eventbriteClientSecret: process.env.EVENTBRITE_CLIENT_SECRET ?? '',
  discordClientId: process.env.DISCORD_CLIENT_ID ?? '',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? '',
  discordRedirectUri:
    process.env.DISCORD_REDIRECT_URI ??
    'http://localhost:5173/auth/discord/callback',
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? '',
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? '',
  apiUrl: process.env.KEEBMEET_API_URL ?? 'http://localhost:3000',
  socketUrl: process.env.KEEBMEET_SOCKET_URL ?? 'http://localhost:3002',
  webUrl: process.env.KEEBMEET_WEB_URL ?? 'http://localhost:5173',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  r2SecretKey: process.env.R2_SECRET_KEY ?? '',
  r2JurisdictionUrl: process.env.R2_JURISDICTION_URL ?? '',
  r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? '',
};

export default config;
