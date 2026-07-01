export interface EventbriteOrganization {
  name: string;
  id: number;
}

export interface EventbriteEvent {
  name: string;
  id: number;
  imageUrl?: string;
  startTime?: string;
  endTime?: string;
  url?: string;
  description?: string;
  venueId?: number;
  organizationId?: number;
}

export interface EventbriteVenue {
  id: number;
  name: string;
  address: string;
}

export interface EventbriteTicket {
  name: string;
  id: number;
  total?: number;
  sold?: number;
}

export interface EventbriteQuestion {
  name: string;
  id: number;
}

export interface EventbriteAttendee {
  id: number;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
  isCheckedIn: boolean;
  checkInStatusUpdatedAt: Date;
  isAttending: boolean;
  ticketClassId: number;
}

export interface EventbriteWebhook {
  id: number;
}
