export interface User {
  id: number;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  is_organizer: boolean;
  is_eventbrite_linked: boolean;
  is_discord_linked: boolean;
  // Resolved from the Discord API at request time; only populated by getUser.
  discord_username?: string | null;
}

export interface DiscordServer {
  id: string; // Discord snowflake; string at runtime
  name: string;
  icon_url: string | null;
}
