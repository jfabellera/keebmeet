import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { type Request, type Response } from 'express';
import { type ParsedQs } from 'qs';
import { ILike, type FindOptionsOrder, type FindOptionsWhere } from 'typeorm';
import { socket } from '../Server';
import config from '../config';
import { EventbriteRecord } from '../entity/EventbriteRecord';
import { Meetup } from '../entity/Meetup';
import { MeetupDisplayRecord } from '../entity/MeetupDisplayRecord';
import { Ticket } from '../entity/Ticket';
import { type User } from '../entity/User';
import { type EventbriteAttendee } from '../interfaces/eventbriteInterfaces';
import { type MeetupDisplayAssets } from '../interfaces/meetupInterfaces';
import {
  createEventbriteWebhook,
  getEventbriteAttendees,
  getEventbriteEvent,
  getEventbriteTicket,
  getEventbriteVenue,
} from '../util/eventbriteApi';
import {
  geocode,
  getUtcOffset,
  type GeocodeResults,
} from '../util/externalApis';
import { decrypt } from '../util/security';
import {
  createMeetupFromEventbriteSchema,
  createMeetupSchema,
  editMeetupSchema,
} from '../util/validator';
import { syncEventbriteAttendee } from './tickets';

dayjs.extend(utc);

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
  organizers?: string[];
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
}

enum MeetupInfoDetailLevel {
  Simple,
  Detailed,
}

const mapMeetupInfo = async (
  meetup: Meetup,
  type: MeetupInfoDetailLevel
): Promise<MeetupInfo> => {
  const meetupInfo: MeetupInfo = {
    id: meetup.id,
    name: meetup.name,
    date: dayjs(meetup.date).utcOffset(meetup.utc_offset).format(),
    duration_hours: meetup.duration_hours,
    location: {
      city: meetup.city,
      state: meetup.state,
      country: meetup.country,
    },
    image_url: meetup.image_url,
  };

  if (meetup.eventbriteRecord != null) {
    meetupInfo.eventbrite_url = meetup.eventbriteRecord.url;
  }

  if (type === MeetupInfoDetailLevel.Detailed) {
    meetupInfo.location.full_address = meetup.address;
    meetupInfo.description = meetup.description;

    meetupInfo.organizers = meetup.organizers.map(
      (organizer) => organizer.nick_name
    );

    // Get ticket details
    const ticketCount = await Ticket.count({
      where: {
        meetup: {
          id: meetup.id,
        },
      },
    });

    meetupInfo.tickets = {
      total: meetup.capacity,
      available: meetup.capacity - ticketCount,
    };
  }

  return meetupInfo;
};

const createMeetupsFilter = (query: ParsedQs): FindOptionsWhere<Meetup> => {
  const findOptionsWhere: FindOptionsWhere<Meetup> = {};

  if (query.by_organizer_id != null) {
    const organizerId = Number(query.by_organizer_id);
    findOptionsWhere.organizers = {
      id: organizerId,
    };
  }

  if (query.by_city != null) {
    const city = String(query.by_city);
    findOptionsWhere.city = ILike(city);
  }

  if (query.by_state != null) {
    const state = String(query.by_state);
    findOptionsWhere.state = ILike(state);
  }

  if (query.by_country != null) {
    const country = String(query.by_country);
    findOptionsWhere.country = ILike(country);
  }

  return findOptionsWhere;
};

const createMeetupsSorting = (query: ParsedQs): FindOptionsOrder<Meetup> => {
  const findOptionsOrder: FindOptionsOrder<Meetup> = {};

  if (query.sort_by != null) {
    const sortBy = query.sort_by as string;

    if (sortBy === 'date_asc') findOptionsOrder.date = 'ASC';
    else if (sortBy === 'date_desc') findOptionsOrder.date = 'DESC';
    else if (sortBy === 'id_asc') findOptionsOrder.id = 'ASC';
    else if (sortBy === 'id_desc') findOptionsOrder.id = 'DESC';
    else findOptionsOrder.date = 'ASC';
  } else {
    findOptionsOrder.date = 'ASC';
  }

  return findOptionsOrder;
};

export const getAllMeetups = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { detail_level } = req.query;

  const detailLevel =
    detail_level != null &&
    (detail_level as string).toLowerCase() === 'detailed'
      ? MeetupInfoDetailLevel.Detailed
      : MeetupInfoDetailLevel.Simple;

  // Build filters and sorting
  const findOptionsWhere = createMeetupsFilter(req.query);
  const findOptionsOrder = createMeetupsSorting(req.query);

  // Query
  const meetups: Array<Promise<MeetupInfo>> = (
    await Meetup.find({
      relations: {
        organizers: true,
        eventbriteRecord: true,
      },
      where: findOptionsWhere,
      order: findOptionsOrder,
    })
  ).map(async (meetup: Meetup): Promise<MeetupInfo> => {
    const meetupInfo = await mapMeetupInfo(meetup, detailLevel);
    return meetupInfo;
  });

  return res.json(await Promise.all(meetups));
};

export const getMeetup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;
  const { detail_level } = req.query;

  const detailLevel =
    detail_level != null && (detail_level as string).toLowerCase() === 'simple'
      ? MeetupInfoDetailLevel.Simple
      : MeetupInfoDetailLevel.Detailed;

  const meetup = await Meetup.findOne({
    relations: {
      organizers: true,
      eventbriteRecord: true,
    },
    where: {
      id: parseInt(meetup_id),
    },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  const meetupInfo = await mapMeetupInfo(meetup, detailLevel);

  return res.json(meetupInfo);
};

export const createMeetup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = createMeetupSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const newMeetup = Meetup.create({
    name: result.data.name,
    date: result.data.date,
    address: result.data.address,
    organizers: [],
    capacity: result.data.capacity,
    duration_hours: result.data.duration_hours,
    image_url: result.data.image_url,
    description: result.data.description,
    has_raffle: result.data.has_raffle,
    default_raffle_entries: result.data.default_raffle_entries,
  });

  // Add requestor to front of organizer list
  newMeetup.organizers.unshift(res.locals.requestor);

  // Remove duplicates
  newMeetup.organizers = Array.from(new Set(newMeetup.organizers));

  // Check if meetup name is taken
  const existingMeetup = await Meetup.findOne({
    where: {
      name: ILike(result.data.name),
    },
  });

  // TODO(jan): Check if organizers are organizers?

  if (existingMeetup != null) {
    return res.status(409).json({ message: 'Meetup name is taken.' });
  }

  // Get UTC offset for the inputted address
  try {
    const geocodeResult = await geocode(req.body.address);

    newMeetup.address = geocodeResult.fullAddress;
    newMeetup.city = geocodeResult.city;
    if (geocodeResult.state != null) newMeetup.state = geocodeResult.state;
    newMeetup.country = geocodeResult.country;

    newMeetup.utc_offset = await getUtcOffset(
      geocodeResult.latitude,
      geocodeResult.longitude,
      new Date(result.data.date)
    );
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }

  // Apply offset to date to be correct UTC
  newMeetup.date = dayjs
    .utc(newMeetup.date)
    .subtract(newMeetup.utc_offset, 'hour')
    .toISOString();

  await newMeetup.save();

  return res.status(201).json(newMeetup);
};

export const createMeetupFromEventbrite = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = createMeetupFromEventbriteSchema.safeParse(req.body);
  const user = res.locals.requestor as User;

  if (!result.success) return res.status(400).json(result.error);
  if (user.encrypted_eventbrite_token == null)
    return res
      .status(401)
      .json({ message: 'No Eventbrite token found for user.' });

  // Get event details
  const ebEvent = await getEventbriteEvent(
    decrypt(user.encrypted_eventbrite_token),
    result.data.eventbrite_event_id
  );

  if (ebEvent?.venueId == null)
    return res
      .status(500)
      .json({ message: 'Unable to get Eventbrite details.' });

  // Get venue details
  const ebVenue = await getEventbriteVenue(
    decrypt(user.encrypted_eventbrite_token),
    ebEvent.venueId
  );

  // Get ticket details
  const ebTicketClass = await getEventbriteTicket(
    decrypt(user.encrypted_eventbrite_token),
    result.data.eventbrite_event_id,
    result.data.eventbrite_ticket_id
  );

  // Reject if any are null
  if (
    ebEvent?.startTime == null ||
    ebEvent?.organizationId == null ||
    ebVenue == null ||
    ebTicketClass == null
  )
    return res
      .status(500)
      .json({ message: 'Unable to get Eventbrite details.' });

  let geocodeResult: GeocodeResults;
  let utcOffset: number;
  try {
    // Get geocode details
    geocodeResult = await geocode(ebVenue.address);
    utcOffset = await getUtcOffset(
      geocodeResult.latitude,
      geocodeResult.longitude,
      new Date(ebEvent.startTime)
    );
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: 'There was an error verifying the address.' });
  }

  try {
    // Create meetup
    const newMeetup = Meetup.create({
      name: ebEvent.name,
      date: ebEvent.startTime,
      address: geocodeResult.fullAddress,
      city: geocodeResult.city,
      state: geocodeResult.state,
      country: geocodeResult.country,
      capacity: ebTicketClass.total,
      duration_hours: dayjs(ebEvent.endTime).diff(ebEvent.startTime, 'hours'),
      image_url: ebEvent.imageUrl,
      description: ebEvent.description,
      organizers: [],
      has_raffle: result.data.has_raffle,
      default_raffle_entries: result.data.default_raffle_entries,
    });

    newMeetup.organizers.unshift(user);
    newMeetup.organizers = Array.from(new Set(newMeetup.organizers));
    newMeetup.utc_offset = utcOffset;

    await newMeetup.save();

    // Create Eventbrite record
    const newEventbriteRecord = EventbriteRecord.create({
      event_id: result.data.eventbrite_event_id,
      ticket_class_id: result.data.eventbrite_ticket_id,
      display_name_question_id: result.data.eventbrite_question_id,
      url: ebEvent?.url,
      meetup: newMeetup,
    });

    const ebWebhook = await createEventbriteWebhook(
      decrypt(user.encrypted_eventbrite_token),
      ebEvent.organizationId,
      ebEvent.id,
      `${config.apiUrl}/meetups/${newMeetup.id}/attendee-webhook?token=${decrypt(user.encrypted_eventbrite_token)}`,
      ['attendee.updated']
    );

    if (ebWebhook != null) newEventbriteRecord.webhook_id = ebWebhook.id;

    await newEventbriteRecord.save();
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: 'There was an error creating meetup.' });
  }

  return res.status(201).end();
};

export const updateMeetup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const result = editMeetupSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const meetup = await Meetup.findOne({
    relations: {
      displayRecord: true,
    },
    where: { id: parseInt(meetup_id) },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  // Check if meetup name is taken
  const existingMeetup = await Meetup.findOne({
    where: {
      name: ILike(req.body.name),
    },
  });

  if (existingMeetup != null) {
    return res.status(409).json({ message: 'Meetup name is taken.' });
  }

  meetup.name = req.body.name ?? meetup.name;
  meetup.duration_hours = req.body.duration_hours ?? meetup.duration_hours;
  meetup.has_raffle = req.body.has_raffle ?? meetup.has_raffle;
  meetup.capacity = req.body.capacity ?? meetup.capacity;
  meetup.image_url = req.body.image_url ?? meetup.image_url;
  meetup.address = req.body.address ?? meetup.address;
  meetup.description = req.body.description ?? meetup.description;
  meetup.default_raffle_entries =
    req.body.default_raffle_entries ?? meetup.default_raffle_entries;

  // TODO(jan): This is mostly copied from createMeetup. We should reduce this duplication
  if (req.body.address != null || req.body.date != null) {
    try {
      const oldLocalDateTime = dayjs
        .utc(meetup.date)
        .add(meetup.utc_offset, 'hour');
      const geocodeResult = await geocode(meetup.address);

      meetup.address = geocodeResult.fullAddress;
      meetup.city = geocodeResult.city;
      if (geocodeResult.state != null) meetup.state = geocodeResult.state;
      meetup.country = geocodeResult.country;

      meetup.utc_offset = await getUtcOffset(
        geocodeResult.latitude,
        geocodeResult.longitude,
        new Date(meetup.date)
      );

      // Apply offset to date to be correct UTC
      meetup.date = dayjs
        .utc(req.body.date ?? oldLocalDateTime)
        .subtract(meetup.utc_offset, 'hour')
        .toISOString();
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  // Handle MeetupDisplayRecord
  if (
    result.data.display_idle_image_urls !== undefined ||
    result.data.display_raffle_background_url !== undefined ||
    result.data.display_batch_raffle_background_url !== undefined
  ) {
    // Create display record if one does not exist
    if (meetup.displayRecord == null) {
      meetup.displayRecord = MeetupDisplayRecord.create();
    }

    if (result.data.display_idle_image_urls !== undefined)
      meetup.displayRecord.idle_image_urls =
        result.data.display_idle_image_urls;

    if (result.data.display_raffle_background_url !== undefined)
      meetup.displayRecord.raffle_background_url =
        result.data.display_raffle_background_url;

    if (result.data.display_batch_raffle_background_url !== undefined)
      meetup.displayRecord.batch_raffle_background_url =
        result.data.display_batch_raffle_background_url;

    await meetup.displayRecord.save();
  }

  // TODO(jan): Implement this correctly with new typeorm entities

  // Only allow "head" organizer to update organizer list
  // if (
  //   meetup.organizer_ids[0] === parseInt(res.locals.requestor.id) &&
  //   organizer_ids != null
  // ) {
  //   meetup.organizer_ids = organizer_ids;

  //   // Cast as number[]
  //   meetup.organizer_ids = meetup.organizer_ids.map((value) => Number(value));

  //   // Add requestor to front of organizer list (prevent head organizer from removing themselves)
  //   meetup.organizer_ids.unshift(parseInt(res.locals.requestor.id));

  //   // Remove duplicates
  //   meetup.organizer_ids = Array.from(new Set(meetup.organizer_ids));
  // } else if (organizer_ids != null) {
  //   return res.status(401).json({
  //     message: 'Only the head organizer can edit the organizer list.',
  //   });
  // }

  await meetup.save();

  socket.emit('meetup:update', { meetupId: meetup.id });
  return res.status(201).json(meetup);
};

export const deleteMeetup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const meetup = await Meetup.findOneBy({
    id: parseInt(meetup_id),
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  if (Number(meetup.organizers[0].id) !== parseInt(res.locals.requestor.id)) {
    return res.status(401).json({
      message: 'Only the head organizer is authorized to delete this meetup.',
    });
  }

  await meetup.remove();

  return res.status(204).end();
};

export const getMeetupAttendees = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const meetup = await Meetup.findOne({
    select: {
      tickets: {
        id: true,
        created_at: true,
        is_checked_in: true,
        checked_in_at: true,
        ticket_holder_display_name: true,
        ticket_holder_first_name: true,
        ticket_holder_last_name: true,
        eventbrite_attendee_id: true,
      },
    },
    relations: { tickets: { user: true }, eventbriteRecord: true },
    where: {
      id: parseInt(meetup_id),
    },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetupID.' });
  }

  const response = meetup.tickets.map((ticket) => {
    const ticketInfo: TicketInfo = {
      id: ticket.id,
      created_at: ticket.created_at,
      is_checked_in: ticket.is_checked_in,
      ticket_holder_display_name: ticket.ticket_holder_display_name,
      ticket_holder_first_name: ticket.ticket_holder_first_name,
      ticket_holder_last_name: ticket.ticket_holder_last_name,
    };

    if (ticket.is_checked_in) {
      ticketInfo.checked_in_at = ticket.checked_in_at;
    }

    return ticketInfo;
  });

  return res.json(response);
};

export const syncEventbriteAttendees = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const user = res.locals.requestor as User;

  if (
    meetup.eventbriteRecord == null ||
    user.encrypted_eventbrite_token == null
  ) {
    return res
      .status(400)
      .json({ message: 'Unable to retrieve Eventbrite data.' });
  }

  let ebAttendees: EventbriteAttendee[];
  try {
    const ebToken = decrypt(user.encrypted_eventbrite_token);
    ebAttendees = await getEventbriteAttendees(
      ebToken,
      meetup.eventbriteRecord.event_id,
      meetup.eventbriteRecord.ticket_class_id,
      meetup.eventbriteRecord.display_name_question_id
    );
  } catch (error: any) {
    return res.status(500).json('Unable to get Eventbrite details.');
  }

  ebAttendees.forEach((attendee) => {
    void (async () => {
      await syncEventbriteAttendee(attendee, meetup);
    })();
  });

  socket.emit('meetup:update', { meetupId: meetup.id });
  return res.status(200).end();
};

export const getMeetupDisplayAssets = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const meetup = await Meetup.findOne({
    relations: { displayRecord: true },
    where: {
      id: Number(meetup_id),
    },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetupID.' });
  }

  return res.status(200).json({
    idleImageUrls: meetup.displayRecord?.idle_image_urls ?? null,
    raffleWinnerBackgroundImageUrl:
      meetup.displayRecord?.raffle_background_url ?? null,
    batchRaffleWinnerBackgroundImageUrl:
      meetup.displayRecord?.batch_raffle_background_url ?? null,
  } satisfies MeetupDisplayAssets);
};
