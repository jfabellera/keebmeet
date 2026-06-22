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
}
