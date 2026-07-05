import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Meetup } from './Meetup';

@Entity({ name: 'meetup_discord_message' })
export class MeetupDiscordMessage extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @OneToOne(() => Meetup, (meetup) => meetup.discordMessage)
  @JoinColumn({ name: 'meetup_id' })
  meetup: Meetup;

  // Discord snowflakes exceed 2^53, so they are stored as strings.
  @Column({ type: 'varchar', length: 32 })
  guild_id: string;

  @Column({ type: 'varchar', length: 32 })
  channel_id: string;

  @Column({ type: 'varchar', length: 32 })
  message_id: string;
}
