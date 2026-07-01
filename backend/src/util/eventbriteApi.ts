import axios from 'axios';
import {
  type EventbriteAttendee,
  type EventbriteEvent,
  type EventbriteOrganization,
  type EventbriteQuestion,
  type EventbriteTicket,
  type EventbriteVenue,
  type EventbriteWebhook,
} from '@keebmeet/shared';

export const getEventbriteOrganizations = async (
  accessToken: string
): Promise<EventbriteOrganization[]> => {
  try {
    const response = await axios.get(
      'https://www.eventbriteapi.com/v3/users/me/organizations/',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const organizations: EventbriteOrganization[] =
      response.data.organizations?.map((organization: any) => {
        return {
          name: organization.name,
          id: organization.id,
        } satisfies EventbriteOrganization;
      });

    return organizations;
  } catch (error: any) {
    return [];
  }
};

export const getEventbriteEvents = async (
  accessToken: string,
  organizationId: number
): Promise<EventbriteEvent[]> => {
  try {
    const response = await axios.get(
      `https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const events: EventbriteEvent[] = response.data.events?.map(
      (event: any) => {
        return {
          name: event.name.text,
          id: event.id,
        } satisfies EventbriteEvent;
      }
    );

    return events;
  } catch (error: any) {
    return [];
  }
};

export const getEventbriteEvent = async (
  accessToken: string,
  eventId: number
): Promise<EventbriteEvent | undefined> => {
  try {
    const response = await axios.get(
      `https://www.eventbriteapi.com/v3/events/${eventId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const event = response.data;

    return {
      id: event.id,
      name: event.name?.text,
      imageUrl: event.logo?.original?.url,
      startTime: event.start?.utc,
      endTime: event.end?.utc,
      url: event.url,
      description: event.summary,
      venueId: event.venue_id,
      organizationId: event.organization_id,
    } satisfies EventbriteEvent;
  } catch (error: any) {
    return undefined;
  }
};

export const getEventbriteVenue = async (
  accessToken: string,
  venueId: number
): Promise<EventbriteVenue | undefined> => {
  try {
    const response = await axios.get(
      `https://www.eventbriteapi.com/v3/venues/${venueId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const venue = response.data;

    return {
      id: venue.id,
      name: venue.name,
      address: venue.address?.localized_address_display,
    } satisfies EventbriteVenue;
  } catch (error: any) {
    return undefined;
  }
};

export const getEventbriteTickets = async (
  accessToken: string,
  eventId: number
): Promise<EventbriteTicket[]> => {
  try {
    const response = await axios.get(
      `https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const tickets: EventbriteTicket[] = response.data.ticket_classes?.map(
      (ticket: any) => {
        return {
          name: ticket.name,
          id: ticket.id,
        } satisfies EventbriteTicket;
      }
    );

    return tickets;
  } catch (error: any) {
    return [];
  }
};

export const getEventbriteTicket = async (
  accessToken: string,
  eventId: number,
  ticketId: number
): Promise<EventbriteTicket | undefined> => {
  try {
    const response = await axios.get(
      `https://www.eventbriteapi.com/v3/events/${eventId}/ticket_classes/${ticketId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const ticket = response.data;

    return {
      id: ticket.id,
      name: ticket.name,
      total: ticket.quantity_total,
      sold: ticket.quantity_sold,
    } satisfies EventbriteTicket;
  } catch (error: any) {
    return undefined;
  }
};

export const getEventbriteQuestions = async (
  accessToken: string,
  eventId: number
): Promise<EventbriteQuestion[]> => {
  try {
    const response = await axios.get(
      `https://www.eventbriteapi.com/v3/events/${eventId}/questions/`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const questions: EventbriteQuestion[] = response.data.questions?.map(
      (question: any) => {
        return {
          name: question.question.text,
          id: question.id,
        } satisfies EventbriteQuestion;
      }
    );

    return questions;
  } catch (error: any) {
    return [];
  }
};

export const getEventbriteAttendees = async (
  accessToken: string,
  eventId: number,
  ticketClassId: number,
  questionId: number
): Promise<EventbriteAttendee[]> => {
  let hasMoreItems = false;
  let attendees: EventbriteAttendee[] = [];
  let page = 1;

  try {
    do {
      const response = await axios.get(
        `https://www.eventbriteapi.com/v3/events/${eventId}/attendees/`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { page },
        }
      );

      hasMoreItems = response.data.pagination.has_more_items;
      page++;

      attendees = attendees.concat(
        response.data.attendees
          .filter((attendee: any) => attendee.ticket_class_id === ticketClassId)
          .map((attendee: any) => {
            return {
              id: attendee.id,
              displayName: attendee.answers.find(
                (question: any) => question.question_id === questionId
              ).answer,
              firstName: attendee.profile.first_name,
              lastName: attendee.profile.last_name,
              email: attendee.profile.email,
              createdAt: attendee.created,
              isCheckedIn: attendee.checked_in,
              checkInStatusUpdatedAt: attendee.barcodes[0].changed,
              isAttending: attendee.cancelled === false,
              ticketClassId: attendee.ticket_class_id,
            } satisfies EventbriteAttendee;
          })
      );
    } while (hasMoreItems);

    return attendees;
  } catch (error: any) {
    return [];
  }
};

export const getEventbriteAttendee = async (
  accessToken: string,
  eventId: number,
  attendeeId: number,
  questionId: number
): Promise<EventbriteAttendee | null> => {
  try {
    const response = await axios.get(
      `https://www.eventbriteapi.com/v3/events/${eventId}/attendees/${attendeeId}/`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const attendee = response.data;

    return {
      id: attendee.id,
      displayName: attendee.answers.find(
        (question: any) => question.question_id === questionId
      ).answer,
      firstName: attendee.profile.first_name,
      lastName: attendee.profile.last_name,
      email: attendee.profile.email,
      createdAt: attendee.created,
      isCheckedIn: attendee.checked_in,
      checkInStatusUpdatedAt: attendee.barcodes[0].changed,
      isAttending: attendee.cancelled === false,
      ticketClassId: attendee.ticket_class_id,
    } satisfies EventbriteAttendee;
  } catch (error: any) {
    return null;
  }
};

// TODO(jan): Reduce code duplication
export const getEventbriteAttendeeByUri = async (
  accessToken: string,
  resourceUri: string,
  questionId: number
): Promise<EventbriteAttendee | undefined> => {
  try {
    const response = await axios.get(resourceUri, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const attendee = response.data;

    return {
      id: attendee.id,
      displayName: attendee.answers.find(
        (question: any) => question.question_id === questionId
      ).answer,
      firstName: attendee.profile.first_name,
      lastName: attendee.profile.last_name,
      email: attendee.profile.email,
      createdAt: attendee.created,
      isCheckedIn: attendee.checked_in,
      checkInStatusUpdatedAt: attendee.barcodes[0].changed,
      isAttending: attendee.cancelled === false,
      ticketClassId: attendee.ticket_class_id,
    } satisfies EventbriteAttendee;
  } catch (error: any) {
    return undefined;
  }
};

export const createEventbriteWebhook = async (
  accessToken: string,
  organizationId: number,
  eventId: number,
  endpointUrl: string,
  actions: Array<
    'attendee.checked_in' | 'attendee.checked_out' | 'attendee.updated'
  >
): Promise<EventbriteWebhook | undefined> => {
  try {
    const data = new FormData();
    data.append('event_id', String(eventId));
    data.append('endpoint_url', endpointUrl);
    data.append('actions', actions.join(','));

    const response = await axios.post(
      `https://www.eventbriteapi.com/v3/organizations/${organizationId}/webhooks/`,
      data,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const webhook = response.data;

    return {
      id: webhook.id,
    } satisfies EventbriteWebhook;
  } catch (error: any) {
    return undefined;
  }
};
