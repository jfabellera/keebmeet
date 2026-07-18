// Response DTOs — the shapes the API returns to clients. Extracted from the
// backend controllers so the frontend can depend on the contract, not on
// server internals.

export interface MeetupInfo {
  // Ids are opaque bigint identifiers, carried as strings end-to-end.
  id: string;
  slug: string;
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
  organizers?: { id: string; username: string; display_name: string }[];
  lead_organizer?: { id: string; username: string; display_name: string };
  tickets?: {
    total: number;
    available: number;
  };
  duration_hours?: number;
  image_url: string;
  eventbrite_url?: string;
  description?: string;
  has_photos?: boolean;
  // True for archived (historical) meetups. Its submitter is the lead_organizer.
  is_archive: boolean;
  // Free-text credit for who ran an archive, when it wasn't the submitter.
  organizer_name?: string;
  // Hidden from public listings; reachable only via direct link.
  is_unlisted?: boolean;
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
  rsvp_method: 'keebmeet' | 'discord' | 'eventbrite';
}

export interface SimpleTicketInfo {
  id: string;
  meetup_id: string;
}

export interface GalleryInfo {
  id: string;
  user_id: string | null;
  display_name: string;
  gallery: string;
}

// OpenGraph-style preview for a stored gallery, scraped server-side (the
// browser can't fetch cross-origin). Keyed by the record id so the client can
// join it onto the corresponding GalleryInfo. Fields are null when unavailable.
export interface GalleryPreview {
  id: string;
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
