import config from '../config';

/**
 * Redirects the browser to Discord's OAuth2 authorization page. Once the user
 * authorizes, Discord redirects back to {@link config.discordRedirectUri} with a
 * `code` query parameter that the callback page exchanges for an MMS session.
 */
export const redirectToDiscordLogin = (): void => {
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.discordRedirectUri,
    response_type: 'code',
    scope: 'identify email',
  });

  window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
};

/**
 * Redirects an already-logged-in user into the Discord OAuth2 flow to link their
 * Discord account. Reuses the same callback, tagging the request with
 * `state=link` so the callback links to the current account instead of signing
 * in.
 */
export const redirectToDiscordLink = (): void => {
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.discordRedirectUri,
    response_type: 'code',
    scope: 'identify email',
    state: 'link',
  });

  window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
};
