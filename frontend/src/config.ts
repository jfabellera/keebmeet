interface Config {
  apiUrl: string;
  authUrl: string;
  socketUrl: string;
  appUrl: string;
  discordClientId: string;
  discordRedirectUri: string;
}

const appUrl = import.meta.env.VITE_MMS_APP_URL ?? 'http://localhost:5173';

const config: Config = {
  apiUrl: import.meta.env.VITE_MMS_API_SERVER_URL ?? 'http://localhost:3000',
  authUrl: import.meta.env.VITE_MMS_AUTH_SERVER_URL ?? 'http://localhost:3001',
  socketUrl:
    import.meta.env.VITE_MMS_SOCKET_SERVER_URL ?? 'http://localhost:3002',
  appUrl,
  discordClientId: import.meta.env.VITE_DISCORD_CLIENT_ID ?? '',
  discordRedirectUri:
    import.meta.env.VITE_DISCORD_REDIRECT_URI ??
    `${appUrl}/auth/discord/callback`,
};

export default config;
