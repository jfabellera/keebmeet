// Response DTOs — the shapes the API returns to clients. Extracted from the
// backend controllers so the frontend can depend on the contract, not on
// server internals.

export interface MeetupInfo {
  // Ids are opaque bigint identifiers, carried as strings end-to-end.
  id: string;
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
  organizers?: { id: string; display_name: string }[];
  lead_organizer?: { id: string; display_name: string };
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
  id: string;
  created_at: Date;
  is_checked_in: boolean;
  checked_in_at?: Date;
  ticket_holder_display_name: string;
  ticket_holder_first_name: string;
  ticket_holder_last_name: string;
  ticket_holder_email: string;
  raffle_entries: number;
  raffle_wins: number;
  qr_code_value: string;
}

export interface SimpleTicketInfo {
  id: string;
  meetup_id: string;
}

export interface PhotoLinkInfo {
  user_id: string;
  display_name: string;
  photo_link: string;
}

// OpenGraph-style preview for a stored photo link, scraped server-side (the
// browser can't fetch cross-origin). Keyed by user_id so the client can join it
// onto the corresponding PhotoLinkInfo. Fields are null when unavailable.
export interface PhotoLinkPreview {
  user_id: string;
  title: string | null;
  image: string | null;
  siteName: string | null;
}

export interface TokenData {
  // The user id is a bigint, carried as a string in the JWT (consumers coerce
  // to a number if they need one).
  id: string;
  nick_name: string;
  is_organizer: boolean;
  is_admin: boolean;
  is_owner: boolean;
}
