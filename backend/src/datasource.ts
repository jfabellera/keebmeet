import 'reflect-metadata';
import { types as pgTypes } from 'pg';
import { DataSource } from 'typeorm';
import config from './config';
import { EventbriteRecord } from './entity/EventbriteRecord';
import { Meetup } from './entity/Meetup';
import { MeetupDiscordMessage } from './entity/MeetupDiscordMessage';
import { MeetupDisplayRecord } from './entity/MeetupDisplayRecord';
import { OrganizerRequest } from './entity/OrganizerRequest';
import { RaffleRecord } from './entity/RaffleRecord';
import { RaffleWinner } from './entity/RaffleWinner';
import { Ticket } from './entity/Ticket';
import { User } from './entity/User';

// node-postgres returns `bigint` (type OID 20) columns as strings to avoid
// precision loss. Every id in this app fits comfortably within a JS safe
// integer, and the whole stack (entities, shared interfaces, zod schemas, JWT)
// models ids as numbers, so parse bigint to a number at the driver level. This
// keeps a single source of truth and avoids scattered `Number(...)` coercions.
// (TypeORM's own count() uses parseInt, so it is unaffected.)
pgTypes.setTypeParser(20, (value) => parseInt(value, 10));

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.databaseHost,
  port: parseInt(config.databasePort),
  username: config.databaseUser,
  password: config.databasePassword,
  database: config.databaseName,
  entities: [
    User,
    Meetup,
    Ticket,
    EventbriteRecord,
    MeetupDisplayRecord,
    MeetupDiscordMessage,
    OrganizerRequest,
    RaffleRecord,
    RaffleWinner,
  ],
  synchronize: false,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsRun: true,
  logging: false,
});
