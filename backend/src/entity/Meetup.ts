import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EventbriteRecord } from './EventbriteRecord';
import { MeetupDiscordMessage } from './MeetupDiscordMessage';
import { MeetupDisplayRecord } from './MeetupDisplayRecord';
import { RaffleRecord } from './RaffleRecord';
import { Ticket } from './Ticket';
import { User } from './User';

@Entity({ name: 'meetups' })
export class Meetup extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'timestamp with time zone' })
  date: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'lead_organizer' })
  lead_organizer: User;

  @ManyToMany(() => User, (user) => user.id)
  @JoinTable()
  organizers: User[];

  @Column({ type: 'boolean', default: true })
  has_raffle: boolean;

  @Column({ type: 'int' })
  capacity: number;

  @Column({ type: 'float' })
  duration_hours: number;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 50 })
  state: string;

  @Column({ type: 'varchar', length: 100 })
  country: string;

  // Float, not int: timezones can be offset by fractional hours (e.g. +5.5,
  // +5.75), as can the Local Mean Time offsets returned for very old dates.
  @Column({ type: 'float' })
  utc_offset: number;

  @Column({ type: 'varchar', length: 255 })
  image_key: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  description: string;

  @Column({ type: 'int', default: 1 })
  default_raffle_entries: number;

  @OneToMany(() => Ticket, (ticket) => ticket.meetup)
  tickets: Ticket[];

  @OneToOne(() => EventbriteRecord, (ebRecord) => ebRecord.meetup)
  eventbriteRecord?: EventbriteRecord;

  @OneToOne(() => MeetupDisplayRecord, (displayRecord) => displayRecord.meetup)
  displayRecord?: MeetupDisplayRecord;

  @OneToOne(
    () => MeetupDiscordMessage,
    (discordMessage) => discordMessage.meetup
  )
  discordMessage?: MeetupDiscordMessage;

  @OneToMany(() => RaffleRecord, (raffleRecord) => raffleRecord.meetup)
  raffleRecords: RaffleRecord[];

  @Column({ type: 'boolean', default: false })
  is_archive: boolean;

  // Free-text credit for who ran an archived meetup (its lead_organizer is
  // always the submitter). Null when the submitter ran it themselves.
  @Column({ type: 'varchar', length: 30, nullable: true })
  organizer_name?: string | null;
}
