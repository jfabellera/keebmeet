// Response DTOs — the shapes the API returns to clients. Extracted from the
// backend controllers so the frontend can depend on the contract, not on
// server internals.

export interface MeetupInfo {
  id: number;
  name: string;
  date: string;
  location: {
    full_address?: string;
    address_line_1?: string;
    address_line_2?: string;
    city: string;
    state: string | null;
    country: string;
    postal_code?: string;
  };
  organizers?: { id: number; display_name: string }[];
  lead_organizer?: { id: number; display_name: string };
  tickets?: {
    total: number;
    available: number;
  };
  duration_hours?: number;
  image_url: string;
  eventbrite_url?: string;
  description?: string;
}

export interface TicketInfo {
  id: number;
  created_at: Date;
  is_checked_in: boolean;
  checked_in_at?: Date;
  ticket_holder_display_name: string;
  ticket_holder_first_name: string;
  ticket_holder_last_name: string;
  ticket_holder_email: string;
  raffle_entries: number;
  raffle_wins: number;
}

export interface SimpleTicketInfo {
  id: number;
  meetup_id: number;
}

export interface TokenData {
  id: number;
  nick_name: string;
  is_organizer: boolean;
  is_admin: boolean;
  is_owner: boolean;
}
