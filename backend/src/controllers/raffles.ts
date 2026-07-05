import {
  claimRaffleWinnerSchema,
  rollRaffleWinnerSchema,
  unclaimRaffleWinnerSchema,
  type RaffleRecordResponse,
  type RaffleWinnerInfo,
  type RollRaffleWinnerResponse,
} from '@keebmeet/shared';
import { type Request, type Response } from 'express';
import { MoreThan, Raw } from 'typeorm';
import { socket } from '../Server';
import { AppDataSource } from '../datasource';
import { type Meetup } from '../entity/Meetup';
import { RaffleRecord } from '../entity/RaffleRecord';
import { RaffleWinner } from '../entity/RaffleWinner';
import { Ticket } from '../entity/Ticket';
import { generateMultipleRandomNumbers } from '../util/math';

const mapRaffleRecordToResponse = (
  raffleRecord: RaffleRecord
): RaffleRecordResponse => {
  return {
    id: raffleRecord.id,
    isBatchRoll: raffleRecord.is_batch_roll,
    winners: raffleRecord.winners.map((winner) => {
      return {
        ticketId: winner.ticket.id,
        displayName: winner.ticket.ticket_holder_display_name,
        firstName: winner.ticket.ticket_holder_first_name,
        lastName: winner.ticket.ticket_holder_last_name,
        wins: winner.ticket.raffle_wins,
        claimed: winner.claimed,
      } satisfies RaffleWinnerInfo;
    }),
    wasDisplayed: raffleRecord.was_displayed,
    createdAt: raffleRecord.created_at,
  } satisfies RaffleRecordResponse;
};

export const rollRaffleWinner = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;
  const result = rollRaffleWinnerSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  // Get eligible tickets with raffle entries. By default only checked-in
  // attendees are eligible; organizers can opt to include those who haven't
  // checked in.
  const tickets = await Ticket.find({
    relations: {
      user: true,
    },
    where: {
      meetup: {
        id: meetup.id,
      },
      ...(!result.data.includeNotCheckedIn ? { is_checked_in: true } : null),
      ...(!result.data.allIn
        ? {
            raffle_entries: MoreThan(0),
            raffle_wins: Raw((wins) => `${wins} < raffle_entries`),
          }
        : null),
    },
    select: {
      id: true,
      ticket_holder_display_name: true,
      ticket_holder_first_name: true,
      ticket_holder_last_name: true,
      raffle_wins: true,
    },
  });

  if (tickets.length > 0) {
    // Randomize winner
    const winnerIndices = generateMultipleRandomNumbers(
      result.data.quantity,
      0,
      tickets.length - 1
    );

    // Create raffle record
    const raffleRecord = RaffleRecord.create({
      meetup,
      is_batch_roll: result.data.quantity > 1,
    });

    await raffleRecord.save();

    // Create raffle winners for the new raffle record
    const raffleWinners = winnerIndices.map((winnerIndex, index) =>
      RaffleWinner.create({
        raffle_record: raffleRecord,
        ticket: tickets[winnerIndex],
        winner_number: index + 1,
        claimed: false,
      })
    );

    raffleWinners.forEach((raffleWinner) => {
      void (async () => {
        await raffleWinner.save();
      })();
    });

    raffleRecord.winners = raffleWinners;

    socket.emit('meetup:update', { meetupId: meetup.id });
    return res.status(200).json({
      losers: tickets.map((ticket) => ticket.ticket_holder_display_name),
      raffleRecord: mapRaffleRecordToResponse(raffleRecord),
    } satisfies RollRaffleWinnerResponse);
  }

  return res.status(200).end();
};

export const claimRaffleWinner = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const ticket = res.locals.ticket as Ticket;
  const result = claimRaffleWinnerSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json(result.error);
  }

  const raffleRecord = await RaffleRecord.findOne({
    relations: { meetup: true, winners: { ticket: true } },
    where: {
      id: result.data.raffleRecordId,
    },
  });

  if (raffleRecord == null)
    return res.status(404).json({ message: 'Raffle record not found.' });

  const raffleWinner = raffleRecord.winners.find(
    (claimedTicket) => claimedTicket.ticket.id === ticket.id
  );

  if (raffleWinner == null)
    return res
      .status(400)
      .json({ message: 'Ticket is not part of raffle record.' });

  if (raffleWinner.claimed)
    return res.status(400).json({
      message: 'Ticket has already been claimed for the given raffle record.',
    });

  raffleWinner.claimed = true;
  await raffleWinner.save();

  ticket.raffle_wins++;
  await ticket.save();

  socket.emit('meetup:update', { meetupId: raffleRecord.meetup.id });
  return res.status(200).end();
};

export const getRaffleRecords = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const meetup = res.locals.meetup as Meetup;

  const raffleRecords = await RaffleRecord.find({
    relations: { winners: { ticket: true } },
    where: {
      meetup: {
        id: meetup.id,
      },
    },
    order: {
      created_at: 'DESC',
      winners: { winner_number: 'ASC' },
    },
  });

  return res.status(200).json(raffleRecords.map(mapRaffleRecordToResponse));
};

export const getRaffleRecord = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { raffle_id } = req.params as Record<string, string>;

  const raffleRecord = await RaffleRecord.findOne({
    relations: { winners: { ticket: true } },
    where: {
      id: raffle_id,
    },
    order: {
      created_at: 'DESC',
      winners: { winner_number: 'ASC' },
    },
  });

  if (raffleRecord == null)
    return res.status(404).json({ message: 'Invalid raffle record ID.' });

  return res.status(200).json(mapRaffleRecordToResponse(raffleRecord));
};

export const markRaffleRecordAsDisplayed = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { raffle_id } = req.params as Record<string, string>;

  const raffleRecord = await RaffleRecord.findOne({
    relations: { meetup: true },
    where: {
      id: raffle_id,
    },
  });

  if (raffleRecord == null)
    return res.status(404).json({ message: 'Invalid raffle record ID.' });

  if (raffleRecord.was_displayed) return res.status(204).end();

  raffleRecord.was_displayed = true;
  await raffleRecord.save();

  socket.emit('meetup:update', { meetupId: raffleRecord.meetup.id });
  return res.status(200).end();
};

export const unclaimRaffleWinner = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { raffle_id } = req.params as Record<string, string>;
  const payload = unclaimRaffleWinnerSchema.safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json(payload.error);
  }

  const raffleRecord = await RaffleRecord.findOne({
    relations: { winners: { ticket: true }, meetup: true },
    where: { id: raffle_id },
  });

  if (raffleRecord == null)
    return res.status(404).json({ message: 'Invalid raffle record ID.' });

  const raffleWinner = raffleRecord.winners.find(
    (winner) => winner.ticket.id === payload.data.ticketId
  );

  if (raffleWinner == null)
    return res
      .status(400)
      .json({ message: 'Ticket is not part of raffle record.' });

  if (!raffleWinner.claimed)
    return res.status(400).json({
      message: 'Ticket has not been claimed for the given raffle record.',
    });

  // Decrease wins
  raffleWinner.ticket.raffle_wins--;
  await raffleWinner.ticket.save();

  // Mark as unclaimed
  raffleWinner.claimed = false;
  await raffleWinner.save();

  socket.emit('meetup:update', { meetupId: raffleRecord.meetup.id });
  return res.status(200).end();
};

export const deleteRaffleRecord = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { raffle_id } = req.params as Record<string, string>;

  const raffleRecord = await RaffleRecord.findOne({
    relations: { winners: { ticket: true }, meetup: true },
    where: { id: raffle_id },
  });

  if (raffleRecord == null)
    return res.status(404).json({ message: 'Invalid raffle record ID.' });

  await AppDataSource.transaction(async (manager) => {
    for (const winner of raffleRecord.winners) {
      // Undo win if the winner was claimed
      if (winner.claimed) {
        await manager.decrement(
          Ticket,
          { id: winner.ticket.id },
          'raffle_wins',
          1
        );
      }

      await manager.remove(winner);
    }

    await manager.remove(raffleRecord);
  });

  socket.emit('meetup:update', { meetupId: raffleRecord.meetup.id });
  return res.status(204).end();
};
