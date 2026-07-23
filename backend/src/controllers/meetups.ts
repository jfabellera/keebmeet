import {
  createArchiveMeetupSchema,
  createMeetupFromEventbriteSchema,
  createMeetupSchema,
  editMeetupSchema,
  SLUG_REGEX,
  transferMeetupSchema,
  type EditMeetupPayload,
  type MeetupDisplayAssets,
  type MeetupInfo,
  type TicketInfo,
} from '@keebmeet/shared';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { type Request, type Response } from 'express';
import { type ParsedQs } from 'qs';
import {
  ILike,
  In,
  type FindOptionsOrder,
  type FindOptionsWhere,
} from 'typeorm';
import { socket } from '../Server';
import config from '../config';
import { AppDataSource } from '../datasource';
import { EventbriteRecord } from '../entity/EventbriteRecord';
import { GalleryRecord } from '../entity/GalleryRecord';
import { Group } from '../entity/Group';
import { Meetup } from '../entity/Meetup';
import { MeetupDisplayRecord } from '../entity/MeetupDisplayRecord';
import { RaffleRecord } from '../entity/RaffleRecord';
import { RaffleWinner } from '../entity/RaffleWinner';
import { Tag } from '../entity/Tag';
import { Ticket } from '../entity/Ticket';
import { User } from '../entity/User';
import { deleteEmbedMessage } from '../util/discord';
import { sendMeetupTransferredEmail } from '../util/email';
import {
  createEventbriteWebhook,
  deleteEventbriteWebhook,
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
import {
  getEffectiveGroupIds,
  getEffectiveGroups,
} from '../util/groupMembership';
import { deleteManagedObjects } from '../util/imageCleanup';
import { normalizeImage } from '../util/imageProcessing';
import { refreshMeetupDiscordMessage } from '../util/meetupDiscordMessage';
import { getVisibleUnlistedMeetups } from '../util/meetupVisibility';
import {
  buildTempImageKey,
  IMAGE_EXT_BY_MIME,
  promoteImage,
  publicUrl,
  toStoredKey,
  upload,
} from '../util/objectStorage';
import { notifyAddedOrganizers } from '../util/organizerAddedNotification';
import { hmacTicket } from '../util/qrCode';
import { decrypt } from '../util/security';
import { slugify, uniqueMeetupSlug } from '../util/slug';
import { syncEventbriteAttendee } from './tickets';

dayjs.extend(utc);

enum MeetupInfoDetailLevel {
  Simple,
  Detailed,
}

const mapMeetupInfo = async (
  meetup: Meetup,
  type: MeetupInfoDetailLevel,
  hasPhotos?: boolean,
  includeGroups = false
): Promise<MeetupInfo> => {
  const meetupInfo: MeetupInfo = {
    id: meetup.id,
    slug: meetup.slug,
    name: meetup.name,
    date: dayjs(meetup.date).utcOffset(meetup.utc_offset).format(),
    duration_hours: meetup.duration_hours,
    location: {
      city: meetup.city,
      state: meetup.state,
      country: meetup.country,
    },
    image_url: publicUrl(meetup.image_key),
    is_archive: meetup.is_archive,
    is_unlisted: meetup.is_unlisted,
  };

  // Display-only credit for an archive's organizer, surfaced on cards/detail.
  if (meetup.organizer_name != null) {
    meetupInfo.organizer_name = meetup.organizer_name;
  }

  if (hasPhotos != null) {
    meetupInfo.has_photos = hasPhotos;
  }

  if (meetup.eventbriteRecord != null) {
    meetupInfo.eventbrite_url = meetup.eventbriteRecord.url;
  }

  if (meetup.tags != null) {
    // Sort tags by name
    meetupInfo.tags = [...meetup.tags]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      }));
  }

  if (type === MeetupInfoDetailLevel.Detailed) {
    meetupInfo.location.full_address = meetup.address;
    meetupInfo.description = meetup.description;

    meetupInfo.organizers = meetup.organizers.map((organizer) => ({
      id: organizer.id,
      username: organizer.username,
      display_name: organizer.nick_name,
    }));
    if (meetup.lead_organizer != null) {
      meetupInfo.lead_organizer = {
        id: meetup.lead_organizer.id,
        username: meetup.lead_organizer.username,
        display_name: meetup.lead_organizer.nick_name,
      };
    }

    if (includeGroups && meetup.groups != null) {
      meetupInfo.groups = meetup.groups.map((group) => ({
        id: group.id,
        name: group.name,
      }));
    }

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

// The subset of the requested group ids the user actually belongs to, as Group
// entities. Membership is effective (explicit joins plus Discord-derived), so an
// organizer can assign a meetup to a group they're only in via Discord; any
// requested id the user isn't in is silently dropped.
const resolveOwnedGroups = async (
  userId: string,
  requestedGroupIds: string[]
): Promise<Group[]> => {
  if (requestedGroupIds.length === 0) return [];
  const user = await User.findOne({
    where: { id: userId },
    relations: { groups: true },
  });
  if (user == null) return [];
  const requested = new Set(requestedGroupIds);
  const effective = await getEffectiveGroups(user);
  return effective.filter((group) => requested.has(group.id));
};

// Unknown ids are dropped. Tags are shared, so there's no ownership to enforce.
const resolveTags = async (tagIds: string[]): Promise<Tag[]> => {
  if (tagIds.length === 0) return [];
  return Tag.findBy({ id: In(tagIds) });
};

const WEBHOOK_CREATION_ERROR = 'Failed to create Eventbrite webhook.';

const parseTagIds = (raw: ParsedQs[string]): string[] => {
  const values = Array.isArray(raw) ? raw : [raw];
  return values
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value));
};

// Meetup ids carrying every one of the given tags.
const getMeetupIdsWithTags = async (tagIds: string[]): Promise<string[]> => {
  const rows = await AppDataSource.createQueryBuilder()
    .select('mt.meetup_id', 'meetup_id')
    .from('meetups_tags', 'mt')
    .where('mt.tag_id IN (:...tagIds)', { tagIds })
    .groupBy('mt.meetup_id')
    .having('COUNT(DISTINCT mt.tag_id) = :tagCount', { tagCount: tagIds.length })
    .getRawMany<{ meetup_id: string }>();
  return rows.map((row) => String(row.meetup_id));
};

// Builds the OR'd where-clauses for a meetup listing. `visibleUnlistedIds` are
// the meetups whose unlisted status the requestor is allowed to see (ones they
// organize or attend); every other unlisted meetup stays hidden from listings.
const createMeetupsFilter = (
  query: ParsedQs,
  visibleUnlistedIds: string[],
  tagMatchedIds: string[] | null
): FindOptionsWhere<Meetup>[] => {
  const base: FindOptionsWhere<Meetup> = {};

  if (query.by_city != null) {
    base.city = ILike(String(query.by_city));
  }
  if (query.by_state != null) {
    base.state = ILike(String(query.by_state));
  }
  if (query.by_country != null) {
    base.country = ILike(String(query.by_country));
  }

  // Restrict to a single organizer's meetups (as an organizer or the lead), or
  // leave unscoped for the general listing.
  const organizerScopes: FindOptionsWhere<Meetup>[] =
    query.by_organizer_id != null
      ? [
          { organizers: { id: String(query.by_organizer_id) } },
          { lead_organizer: { id: String(query.by_organizer_id) } },
        ]
      : [{}];

  // Public meetups, plus any unlisted meetup the requestor may see.
  const visibilityScopes: FindOptionsWhere<Meetup>[] = [{ is_unlisted: false }];
  if (visibleUnlistedIds.length > 0) {
    visibilityScopes.push({ id: In(visibleUnlistedIds) });
  }

  const tagMatchedSet = tagMatchedIds != null ? new Set(tagMatchedIds) : null;

  // Cartesian product: find() ORs the array, and each entry ANDs its keys.
  return organizerScopes.flatMap((organizerScope) =>
    visibilityScopes.map((visibilityScope) => {
      const scope: FindOptionsWhere<Meetup> = {
        ...base,
        ...organizerScope,
        ...visibilityScope,
      };
      if (tagMatchedSet != null) {
        scope.id =
          visibilityScope.id != null
            ? In(visibleUnlistedIds.filter((id) => tagMatchedSet.has(id)))
            : In([...tagMatchedSet]);
      }
      return scope;
    })
  );
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

  // Unlisted meetups stay out of listings for the public, but interested
  // parties — the organizers, the attendees, and members of a group the meetup
  // is assigned to — still see them (badged).
  const requestor = res.locals.requestor as User | undefined;
  const {
    organizedIds,
    attendedIds,
    groupMeetupIds,
    all: visibleUnlistedIds,
  } = await getVisibleUnlistedMeetups(requestor);

  const tagIds =
    req.query.by_tag_ids != null ? parseTagIds(req.query.by_tag_ids) : [];
  const tagMatchedIds =
    tagIds.length > 0 ? await getMeetupIdsWithTags(tagIds) : null;

  // Build filters and sorting
  const findOptionsWhere = createMeetupsFilter(
    req.query,
    visibleUnlistedIds,
    tagMatchedIds
  );
  const findOptionsOrder = createMeetupsSorting(req.query);

  // Query
  const meetupEntities = await Meetup.find({
    relations: {
      organizers: true,
      lead_organizer: true,
      eventbriteRecord: true,
      tags: true,
    },
    where: findOptionsWhere,
    order: findOptionsOrder,
  });

  // Determine which of these meetups have any galleries in a single grouped
  // query, so the list carries a "has photos" flag without an N+1 per meetup.
  const meetupIdsWithPhotos = new Set<string>();
  const meetupIds = meetupEntities.map((meetup) => meetup.id);
  if (meetupIds.length > 0) {
    const rows = await GalleryRecord.createQueryBuilder('photo')
      .select('photo.meetup_id', 'meetup_id')
      .where('photo.meetup_id IN (:...meetupIds)', { meetupIds })
      .groupBy('photo.meetup_id')
      .getRawMany<{ meetup_id: string }>();
    for (const row of rows) {
      meetupIdsWithPhotos.add(String(row.meetup_id));
    }
  }

  const meetups = meetupEntities.map(
    async (meetup: Meetup): Promise<MeetupInfo> => {
      const info = await mapMeetupInfo(
        meetup,
        detailLevel,
        meetupIdsWithPhotos.has(meetup.id)
      );
      if (info.is_unlisted === true) {
        // Organizer outranks attendee outranks group as the explanation shown.
        if (organizedIds.has(meetup.id)) info.unlisted_reason = 'organizer';
        else if (attendedIds.has(meetup.id)) info.unlisted_reason = 'attendee';
        else if (groupMeetupIds.has(meetup.id)) info.unlisted_reason = 'group';
      }
      return info;
    }
  );

  return res.json(await Promise.all(meetups));
};

export const getMeetup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id: slug } = req.params as Record<string, string>;
  const { detail_level } = req.query;

  const detailLevel =
    detail_level != null && (detail_level as string).toLowerCase() === 'simple'
      ? MeetupInfoDetailLevel.Simple
      : MeetupInfoDetailLevel.Detailed;

  // Public reads resolve by slug only; a numeric id 404s.
  const meetup = await Meetup.findOne({
    relations: {
      organizers: true,
      lead_organizer: true,
      eventbriteRecord: true,
      groups: true,
      tags: true,
    },
    where: {
      slug,
    },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Meetup not found.' });
  }

  // Only include groups for organizers
  const requestor = res.locals.requestor as User | undefined;
  const isOrganizer =
    requestor != null &&
    (meetup.lead_organizer?.id === requestor.id ||
      meetup.organizers.some((organizer) => organizer.id === requestor.id));

  const meetupInfo = await mapMeetupInfo(
    meetup,
    detailLevel,
    undefined,
    isOrganizer
  );

  return res.json(meetupInfo);
};

export const slugAvailable = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const slug = String(req.query.slug ?? '');
  const excludeId =
    req.query.exclude_id != null ? String(req.query.exclude_id) : null;

  if (!SLUG_REGEX.test(slug)) {
    return res.json({ available: false });
  }

  const existing = await Meetup.findOne({
    where: { slug },
    select: { id: true },
  });
  return res.json({ available: existing == null || existing.id === excludeId });
};

/**
 * Accepts a single multipart image file, stores it in R2, and returns the
 * object key plus a browser-loadable URL. Organizers upload here first, then
 * pass the returned `image_key` when creating or editing a meetup.
 */
export const uploadMeetupImage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const file = req.file;

  if (file == null) {
    return res.status(400).json({ message: 'No image file provided.' });
  }

  const ext = IMAGE_EXT_BY_MIME[file.mimetype];
  if (ext === undefined) {
    return res
      .status(400)
      .json({ message: 'Unsupported image type. Use PNG, JPEG, or WebP.' });
  }

  let processed: Buffer;
  try {
    processed = await normalizeImage(file.buffer, file.mimetype, {
      maxDimension: 3840,
    });
  } catch {
    return res
      .status(400)
      .json({ message: 'Could not process the uploaded image.' });
  }

  // Stored under the temp prefix; promoted to permanent when a meetup is saved.
  const key = buildTempImageKey('meetups', ext);
  await upload(key, processed, file.mimetype);

  return res.status(201).json({ image_key: key, image_url: publicUrl(key) });
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
    slug: result.data.slug,
    date: result.data.date,
    address: result.data.address,
    organizers: [],
    capacity: result.data.capacity,
    duration_hours: result.data.duration_hours,
    image_key: result.data.image_key,
    description: result.data.description,
    has_raffle: result.data.has_raffle,
    default_raffle_entries: result.data.default_raffle_entries,
    is_unlisted: result.data.is_unlisted,
  });

  const requestor = res.locals.requestor as User;

  // The creator owns the meetup as its lead organizer. `organizers` holds only
  // the additional (co-)organizers, so the requestor is not added there.
  newMeetup.lead_organizer = requestor;

  // Add any additional organizers selected by the requestor, excluding the
  // requestor themselves (they're the lead, tracked separately).
  if (
    result.data.organizer_ids != null &&
    result.data.organizer_ids.length > 0
  ) {
    const additionalOrganizers = await User.findBy({
      id: In(result.data.organizer_ids),
    });
    newMeetup.organizers.push(
      ...additionalOrganizers.filter((user) => user.id !== requestor.id)
    );
  }

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

  if ((await Meetup.countBy({ slug: result.data.slug })) > 0) {
    return res.status(409).json({ message: 'That URL is already taken.' });
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

  // Promote the uploaded image out of the temp prefix now that we're committing.
  try {
    newMeetup.image_key = await promoteImage(newMeetup.image_key);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to store meetup image.' });
  }

  // Assign the meetup to the requestor's own groups. As a fresh entity, saving
  // with the relation set inserts the join rows (safe here, unlike on edit).
  newMeetup.groups = await resolveOwnedGroups(
    requestor.id,
    result.data.group_ids ?? []
  );

  newMeetup.tags = await resolveTags(result.data.tag_ids ?? []);

  await newMeetup.save();

  return res.status(201).json(newMeetup);
};

export const createArchiveMeetup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const result = createArchiveMeetupSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const requestor = res.locals.requestor as User;

  // Check if meetup name is taken
  const existingMeetup = await Meetup.findOne({
    where: {
      name: ILike(result.data.name),
    },
  });

  if (existingMeetup != null) {
    return res.status(409).json({ message: 'Meetup name is taken.' });
  }

  if ((await Meetup.countBy({ slug: result.data.slug })) > 0) {
    return res.status(409).json({ message: 'That URL is already taken.' });
  }

  const newMeetup = Meetup.create({
    name: result.data.name,
    slug: result.data.slug,
    date: result.data.date,
    address: result.data.address,
    image_key: result.data.image_key,
    description: result.data.description ?? '',
    organizers: [],
    // Archive meetups are historical records with no live sign-ups or raffle.
    capacity: 0,
    duration_hours: 0,
    has_raffle: false,
    is_archive: true,
    is_unlisted: result.data.is_unlisted,
    // organizer_name is a display-only credit; who actually ran the meetup.
    // Omitted (null) when the submitter ran it themselves.
    organizer_name: result.data.organizer_name,
  });

  // The submitter always owns the archive so it can never be orphaned — they
  // can manage and delete it. Who ran it is recorded separately in
  // organizer_name for display only.
  newMeetup.lead_organizer = requestor;

  // Get UTC offset for the inputted address
  try {
    const geocodeResult = await geocode(result.data.address);

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

  // Promote the uploaded image out of the temp prefix now that we're committing.
  try {
    newMeetup.image_key = await promoteImage(newMeetup.image_key);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to store meetup image.' });
  }

  newMeetup.groups = await resolveOwnedGroups(
    requestor.id,
    result.data.group_ids ?? []
  );

  newMeetup.tags = await resolveTags(result.data.tag_ids ?? []);

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

  // Check if meetup name is taken (the Eventbrite event name becomes the
  // meetup name, so reject before doing any further work).
  const existingMeetup = await Meetup.findOne({
    where: {
      name: ILike(ebEvent.name),
    },
  });

  if (existingMeetup != null) {
    return res.status(409).json({ message: 'Meetup name is taken.' });
  }

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

  const ebToken = decrypt(user.encrypted_eventbrite_token);
  const organizationId = ebEvent.organizationId;

  let createdMeetup: Meetup | undefined;
  try {
    await AppDataSource.transaction(async (manager) => {
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
        // Eventbrite provides an external absolute URL; stored as-is and passed
        // through publicUrl() unchanged on read.
        image_key: ebEvent.imageUrl,
        description: ebEvent.description,
        organizers: [],
        has_raffle: result.data.has_raffle,
        default_raffle_entries: result.data.default_raffle_entries,
      });

      // The creator owns the meetup as its lead organizer; `organizers` holds
      // only additional co-organizers (none for an Eventbrite import).
      newMeetup.lead_organizer = user;
      newMeetup.utc_offset = utcOffset;
      // No form here, so derive a unique slug from the event name server-side.
      newMeetup.slug = await uniqueMeetupSlug(slugify(ebEvent.name));

      await manager.save(newMeetup);

      const ebWebhook = await createEventbriteWebhook(
        ebToken,
        organizationId,
        ebEvent.id,
        `${config.apiUrl}/meetups/${newMeetup.id}/attendee-webhook?token=${ebToken}`,
        ['attendee.updated']
      );

      // No webhook, no meetup: throwing here rolls back the meetup save above.
      // (createEventbriteWebhook logs the underlying Eventbrite error.)
      if (ebWebhook == null) {
        throw new Error(WEBHOOK_CREATION_ERROR);
      }

      // Create Eventbrite record
      const newEventbriteRecord = EventbriteRecord.create({
        event_id: result.data.eventbrite_event_id,
        ticket_class_id: result.data.eventbrite_ticket_id,
        display_name_question_id: result.data.eventbrite_question_id,
        url: ebEvent.url,
        webhook_id: ebWebhook.id,
        meetup: newMeetup,
      });

      await manager.save(newEventbriteRecord);

      newMeetup.eventbriteRecord = newEventbriteRecord;
      createdMeetup = newMeetup;
    });
  } catch (error: any) {
    console.error('Failed to create meetup from Eventbrite:', error);
    if (error?.message === WEBHOOK_CREATION_ERROR) {
      return res.status(502).json({
        message:
          'Could not register the Eventbrite webhook. Make sure your Eventbrite account is connected and try again.',
      });
    }
    return res
      .status(500)
      .json({ message: 'There was an error creating meetup.' });
  }

  if (createdMeetup != null) {
    try {
      await syncMeetupEventbriteAttendees(createdMeetup, ebToken);
    } catch (error: any) {
      console.error('Failed initial Eventbrite attendee sync:', error);
    }
  }

  return res.status(201).end();
};

/**
 * Applies display-image edits to a meetup's display record: promotes freshly
 * uploaded temp images to permanent keys, persists the record, then deletes any
 * managed objects that were replaced or removed. Throws if a promotion fails.
 */
const syncDisplayRecord = async (
  meetup: Meetup,
  data: EditMeetupPayload
): Promise<void> => {
  const prevIdle = meetup.displayRecord?.idle_image_urls ?? [];
  const prevRaffle = meetup.displayRecord?.raffle_background_url ?? null;
  const prevBatch = meetup.displayRecord?.batch_raffle_background_url ?? null;

  if (meetup.displayRecord == null) {
    meetup.displayRecord = MeetupDisplayRecord.create();
  }
  const record = meetup.displayRecord;

  // Recover the stored key from a re-submitted public URL, then promote any
  // freshly uploaded temp image to its permanent key.
  const store = async (value: string): Promise<string> =>
    promoteImage(toStoredKey(value));

  if (data.display_idle_image_urls !== undefined) {
    record.idle_image_urls = await Promise.all(
      data.display_idle_image_urls.filter((value) => value !== '').map(store)
    );
  }
  if (data.display_raffle_background_url !== undefined) {
    record.raffle_background_url =
      data.display_raffle_background_url === null
        ? null
        : await store(data.display_raffle_background_url);
  }
  if (data.display_batch_raffle_background_url !== undefined) {
    record.batch_raffle_background_url =
      data.display_batch_raffle_background_url === null
        ? null
        : await store(data.display_batch_raffle_background_url);
  }

  await record.save();

  // Best-effort cleanup of images no longer referenced (deleteManagedObjects
  // skips external URLs and empties).
  await deleteManagedObjects(
    [
      ...prevIdle.filter((key) => !record.idle_image_urls.includes(key)),
      prevRaffle !== record.raffle_background_url ? prevRaffle : null,
      prevBatch !== record.batch_raffle_background_url ? prevBatch : null,
    ].filter((key): key is string => key != null)
  );
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
      // ManyToOne — safe to load on the saved entity (unlike the organizers
      // ManyToMany). Used to keep the lead out of the co-organizer list.
      lead_organizer: true,
    },
    where: { id: meetup_id },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  // Only the lead organizer may change the co-organizer list. Co-organizers can
  // edit every other field, but altering who runs the meetup is reserved to the
  // lead. Checked before any mutation so a forbidden request changes nothing.
  const requestor = res.locals.requestor as User;
  const isLead = meetup.lead_organizer?.id === requestor?.id;
  if (result.data.organizer_ids != null && !isLead) {
    return res.status(403).json({
      message: 'Only the lead organizer can update the organizers list.',
    });
  }
  // Likewise, only the lead organizer may change the meetup's groups.
  if (result.data.group_ids != null && !isLead) {
    return res.status(403).json({
      message: "Only the lead organizer can update the meetup's groups.",
    });
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

  if (result.data.slug != null && result.data.slug !== meetup.slug) {
    if ((await Meetup.countBy({ slug: result.data.slug })) > 0) {
      return res.status(409).json({ message: 'That URL is already taken.' });
    }
  }

  // Remember the current image so we can clean it up if it gets replaced.
  const previousImageKey = meetup.image_key;

  meetup.name = req.body.name ?? meetup.name;
  meetup.slug = req.body.slug ?? meetup.slug;
  meetup.duration_hours = req.body.duration_hours ?? meetup.duration_hours;
  meetup.has_raffle = req.body.has_raffle ?? meetup.has_raffle;
  meetup.capacity = req.body.capacity ?? meetup.capacity;
  meetup.image_key = req.body.image_key ?? meetup.image_key;
  meetup.address = req.body.address ?? meetup.address;
  meetup.description = req.body.description ?? meetup.description;
  meetup.default_raffle_entries =
    req.body.default_raffle_entries ?? meetup.default_raffle_entries;
  meetup.is_unlisted = req.body.is_unlisted ?? meetup.is_unlisted;

  // Archive-only credit for who ran the meetup. An empty string clears it back
  // to the submitter (who is always the lead organizer).
  if (meetup.is_archive && req.body.organizer_name !== undefined) {
    meetup.organizer_name =
      req.body.organizer_name === '' ? null : req.body.organizer_name;
  }

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
    try {
      await syncDisplayRecord(meetup, result.data);
    } catch (error) {
      return res
        .status(500)
        .json({ message: 'Failed to store display image.' });
    }
  }

  // Promote a newly uploaded image out of the temp prefix (no-op if the image
  // is unchanged or is an external URL).
  try {
    meetup.image_key = await promoteImage(meetup.image_key);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to store meetup image.' });
  }

  await meetup.save();

  // Update the co-organizer list to match organizer_ids. `organizers` holds
  // co-organizers only — the lead is tracked separately and is filtered out
  // here so it can never be added to (or removed from) this list. We read the
  // current organizers in a separate query: the ManyToMany relation is
  // deliberately NOT loaded on the saved entity above, since save()ing an entity
  // with the relation loaded re-inserts the join rows and trips the join table's
  // primary key. The join table is instead updated via the relation builder.
  if (result.data.organizer_ids != null) {
    const withOrganizers = await Meetup.findOne({
      relations: { organizers: true },
      where: { id: meetup.id },
    });
    const currentIds = (withOrganizers?.organizers ?? []).map(
      (organizer) => organizer.id
    );
    const leadId =
      meetup.lead_organizer != null ? meetup.lead_organizer.id : null;
    const desiredIds = Array.from(new Set(result.data.organizer_ids)).filter(
      (id) => id !== leadId
    );
    const toAdd = desiredIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !desiredIds.includes(id));
    if (toAdd.length > 0 || toRemove.length > 0) {
      await AppDataSource.createQueryBuilder()
        .relation(Meetup, 'organizers')
        .of(meetup.id)
        .addAndRemove(toAdd, toRemove);
    }

    // Email newly added co-organizers (verified users only). Best-effort: a
    // mail failure shouldn't fail the update.
    await notifyAddedOrganizers(
      toAdd,
      meetup.id,
      meetup.name,
      meetup.lead_organizer?.nick_name ?? 'A lead organizer'
    );
  }

  // Sync the meetup's groups to the requestor's selection, but only within the
  // groups the requestor belongs to: they can add/remove their own groups while
  // leaving groups assigned by other organizers untouched. Updated via the
  // relation builder for the same reason organizers are (see above).
  if (result.data.group_ids != null) {
    const membership = await User.findOne({
      where: { id: requestor.id },
      relations: { groups: true },
    });
    const memberIds = new Set(
      membership != null ? await getEffectiveGroupIds(membership) : []
    );
    // The requestor can only set groups they're in; ignore any others.
    const desiredIds = new Set(
      result.data.group_ids.filter((id) => memberIds.has(id))
    );
    const withGroups = await Meetup.findOne({
      relations: { groups: true },
      where: { id: meetup.id },
    });
    const currentIds = (withGroups?.groups ?? []).map((g) => g.id);
    const toAddGroups = [...desiredIds].filter(
      (id) => !currentIds.includes(id)
    );
    // Only remove groups the requestor is a member of; leave others' groups.
    const toRemoveGroups = currentIds.filter(
      (id) => memberIds.has(id) && !desiredIds.has(id)
    );
    if (toAddGroups.length > 0 || toRemoveGroups.length > 0) {
      await AppDataSource.createQueryBuilder()
        .relation(Meetup, 'groups')
        .of(meetup.id)
        .addAndRemove(toAddGroups, toRemoveGroups);
    }
  }

  // Any organizer may edit tags (unlike groups/organizers, which are lead-only).
  // Updated via the relation builder, as with organizers/groups above.
  if (result.data.tag_ids != null) {
    const desiredTags = await resolveTags(
      Array.from(new Set(result.data.tag_ids))
    );
    const desiredIds = new Set(desiredTags.map((tag) => tag.id));
    const withTags = await Meetup.findOne({
      relations: { tags: true },
      where: { id: meetup.id },
    });
    const currentIds = (withTags?.tags ?? []).map((tag) => tag.id);
    const toAddTags = [...desiredIds].filter((id) => !currentIds.includes(id));
    const toRemoveTags = currentIds.filter((id) => !desiredIds.has(id));
    if (toAddTags.length > 0 || toRemoveTags.length > 0) {
      await AppDataSource.createQueryBuilder()
        .relation(Meetup, 'tags')
        .of(meetup.id)
        .addAndRemove(toAddTags, toRemoveTags);
    }
  }

  // Best-effort cleanup of the replaced image, after a successful save.
  if (previousImageKey !== meetup.image_key) {
    await deleteManagedObjects([previousImageKey]);
  }

  socket.emit('meetup:update', { meetupId: meetup.id });
  await refreshMeetupDiscordMessage(meetup.id);
  return res.status(201).json(meetup);
};

export const transferMeetup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;

  const result = transferMeetupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const meetup = await Meetup.findOne({
    relations: {
      lead_organizer: true,
    },
    where: { id: meetup_id },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  // Verify requestor is lead organizer (authChecker only checks organizer)
  const requestor = res.locals.requestor as User;
  if (meetup.lead_organizer?.id !== requestor.id) {
    return res.status(403).json({
      message: 'Only the lead organizer can transfer this meetup.',
    });
  }

  const newLeadId = result.data.new_lead_organizer_id;

  if (newLeadId === requestor.id) {
    return res
      .status(400)
      .json({ message: 'You are already the lead organizer.' });
  }

  const newLead = await User.findOneBy({ id: newLeadId });
  if (newLead == null) {
    return res.status(404).json({ message: 'Invalid user ID.' });
  }

  // The new lead must be an organizer, same as any meetup owner.
  if (!newLead.is_organizer) {
    return res
      .status(400)
      .json({ message: 'The new lead organizer must be an organizer.' });
  }

  const previousLead = meetup.lead_organizer;

  meetup.lead_organizer = newLead;

  // Assume that a transferred archive meetup was organized by the new lead so
  // clear the display credit
  if (meetup.is_archive) {
    meetup.organizer_name = null;
  }

  await meetup.save();

  // Remove new lead from organizer list if previously added as a co-organizer
  // and demote previous lead to co-organizer (only if not an archive meetup -
  // previous lead loses all access)
  const demotedLeadIds =
    !meetup.is_archive && previousLead != null ? [previousLead.id] : [];
  await AppDataSource.createQueryBuilder()
    .relation(Meetup, 'organizers')
    .of(meetup.id)
    .addAndRemove(demotedLeadIds, [newLeadId]);

  socket.emit('meetup:update', { meetupId: meetup.id });
  await refreshMeetupDiscordMessage(meetup.id);

  // Notify the new lead organizer by email (verified users only). Best-effort:
  // a mail failure must not fail the transfer, which is already committed.
  if (newLead.is_verified) {
    try {
      await sendMeetupTransferredEmail(
        newLead.email,
        meetup.name,
        requestor.nick_name,
        `${config.webUrl}/meetup/${meetup.slug}/manage`
      );
    } catch (error) {
      console.error('Failed to send meetup transferred email:', error);
    }
  }

  return res.status(200).json(meetup);
};

export const deleteMeetup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { meetup_id } = req.params as Record<string, string>;
  const meetupId = meetup_id;

  const meetup = await Meetup.findOne({
    relations: {
      tickets: true,
      raffleRecords: true,
      discordMessage: true,
      eventbriteRecord: true,
      displayRecord: true,
      lead_organizer: true,
    },
    where: { id: meetupId },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetup ID.' });
  }

  // The auth middleware verifies the requestor is an organizer of this meetup,
  // but deletion is reserved to the lead organizer alone — co-organizers can
  // manage the meetup but not destroy it.
  const requestor = res.locals.requestor as User;
  if (meetup.lead_organizer?.id !== requestor.id) {
    return res.status(403).json({
      message: 'Only the lead organizer can delete this meetup.',
    });
  }

  // Best-effort removal of the announcement embed from Discord before we drop
  // our own record of it. A failure here shouldn't block deleting the meetup.
  if (meetup.discordMessage != null) {
    try {
      await deleteEmbedMessage(
        meetup.discordMessage.channel_id,
        meetup.discordMessage.message_id
      );
    } catch (error: any) {
      console.error(
        'Failed to delete Discord message during meetup deletion:',
        error.response?.status,
        error.response?.data ?? error.message
      );
    }
  }

  if (
    meetup.eventbriteRecord != null &&
    requestor.encrypted_eventbrite_token != null
  ) {
    await deleteEventbriteWebhook(
      decrypt(requestor.encrypted_eventbrite_token),
      meetup.eventbriteRecord.webhook_id
    );
  }

  const ticketIds = meetup.tickets.map((ticket) => ticket.id);
  const raffleRecordIds = meetup.raffleRecords.map((record) => record.id);

  // There are no cascading deletes configured at the DB level, so we remove all
  // dependent records by hand inside a transaction to keep the data consistent.
  await AppDataSource.transaction(async (manager) => {
    if (raffleRecordIds.length > 0) {
      await manager
        .createQueryBuilder()
        .delete()
        .from(RaffleWinner)
        .where('raffle_record_id IN (:...raffleRecordIds)', { raffleRecordIds })
        .execute();
    }
    if (ticketIds.length > 0) {
      // Defensive: clear any raffle wins still referencing these tickets.
      await manager
        .createQueryBuilder()
        .delete()
        .from(RaffleWinner)
        .where('ticket_id IN (:...ticketIds)', { ticketIds })
        .execute();
    }
    if (raffleRecordIds.length > 0) {
      await manager.delete(RaffleRecord, { id: In(raffleRecordIds) });
    }
    if (ticketIds.length > 0) {
      await manager.delete(Ticket, { id: In(ticketIds) });
    }
    if (meetup.eventbriteRecord != null) {
      await manager.remove(meetup.eventbriteRecord);
    }
    if (meetup.displayRecord != null) {
      await manager.remove(meetup.displayRecord);
    }
    if (meetup.discordMessage != null) {
      await manager.remove(meetup.discordMessage);
    }
    await manager
      .createQueryBuilder()
      .delete()
      .from(GalleryRecord)
      .where('meetup_id = :meetupId', { meetupId })
      .execute();
    // Removing the meetup also clears its rows in the organizers join table.
    await manager.remove(meetup);
  });

  // Best-effort cleanup of the meetup's R2 image objects, after the DB delete
  // commits.
  await deleteManagedObjects([
    meetup.image_key,
    ...(meetup.displayRecord?.idle_image_urls ?? []),
    meetup.displayRecord?.raffle_background_url ?? '',
    meetup.displayRecord?.batch_raffle_background_url ?? '',
  ]);

  socket.emit('meetup:update', { meetupId });

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
        ticket_holder_email: true,
        raffle_entries: true,
        raffle_wins: true,
        eventbrite_attendee_id: true,
        rsvp_method: true,
      },
    },
    relations: { tickets: { user: true }, eventbriteRecord: true },
    where: {
      id: meetup_id,
    },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetupID.' });
  }

  const response = meetup.tickets.map((ticket) => {
    const qrCodeValue = hmacTicket(ticket.id);

    const ticketInfo: TicketInfo = {
      id: ticket.id,
      created_at: ticket.created_at,
      is_checked_in: ticket.is_checked_in,
      ticket_holder_display_name: ticket.ticket_holder_display_name,
      ticket_holder_first_name: ticket.ticket_holder_first_name,
      ticket_holder_last_name: ticket.ticket_holder_last_name,
      ticket_holder_email: ticket.ticket_holder_email,
      raffle_entries: ticket.raffle_entries,
      raffle_wins: ticket.raffle_wins,
      qr_code_value: qrCodeValue,
      rsvp_method: ticket.rsvp_method,
    };

    if (ticket.is_checked_in) {
      ticketInfo.checked_in_at = ticket.checked_in_at;
    }

    return ticketInfo;
  });

  return res.json(response);
};

export const syncMeetupEventbriteAttendees = async (
  meetup: Meetup,
  ebToken: string
): Promise<void> => {
  if (meetup.eventbriteRecord == null) return;

  const ebAttendees = await getEventbriteAttendees(
    ebToken,
    meetup.eventbriteRecord.event_id,
    meetup.eventbriteRecord.ticket_class_id,
    meetup.eventbriteRecord.display_name_question_id
  );

  await Promise.all(
    ebAttendees.map(async (attendee) => {
      await syncEventbriteAttendee(attendee, meetup);
    })
  );

  socket.emit('meetup:update', { meetupId: meetup.id });
  await refreshMeetupDiscordMessage(meetup.id);
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

  try {
    await syncMeetupEventbriteAttendees(
      meetup,
      decrypt(user.encrypted_eventbrite_token)
    );
  } catch (error: any) {
    return res.status(500).json('Unable to get Eventbrite details.');
  }

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
      id: meetup_id,
    },
  });

  if (meetup == null) {
    return res.status(404).json({ message: 'Invalid meetupID.' });
  }

  const display = meetup.displayRecord;
  return res.status(200).json({
    idleImageUrls:
      display != null ? display.idle_image_urls.map(publicUrl) : null,
    raffleWinnerBackgroundImageUrl:
      display?.raffle_background_url != null
        ? publicUrl(display.raffle_background_url)
        : null,
    batchRaffleWinnerBackgroundImageUrl:
      display?.batch_raffle_background_url != null
        ? publicUrl(display.batch_raffle_background_url)
        : null,
  } satisfies MeetupDisplayAssets);
};
