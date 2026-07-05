export interface EventbriteOrganization {
  name: string;
  id: string;
}

export interface EventbriteEvent {
  name: string;
  id: string;
  imageUrl?: string;
  startTime?: string;
  endTime?: string;
  url?: string;
  description?: string;
  venueId?: string;
  organizationId?: string;
}

export interface EventbriteVenue {
  id: string;
  name: string;
  address: string;
}

export interface EventbriteTicket {
  name: string;
  id: string;
  total?: number;
  sold?: number;
}

export interface EventbriteQuestion {
  name: string;
  id: string;
}

export interface EventbriteAttendee {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
  isCheckedIn: boolean;
  checkInStatusUpdatedAt: Date;
  isAttending: boolean;
  ticketClassId: string;
}

export interface EventbriteWebhook {
  id: string;
}
