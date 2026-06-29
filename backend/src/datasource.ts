import 'reflect-metadata';
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
  synchronize: true,
  logging: false,
});
