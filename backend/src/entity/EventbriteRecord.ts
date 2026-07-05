import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Meetup } from './Meetup';

@Entity({ name: 'eventbrite_record' })
export class EventbriteRecord extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  // bigint columns are returned by the pg driver as strings. These hold
  // external Eventbrite ids; the surrounding code works in numbers (zod
  // payloads, API params), so coerce at the entity boundary.
  @Column({ type: 'bigint' })
  event_id: string;

  @Column({ type: 'bigint' })
  ticket_class_id: string;

  @Column({ type: 'bigint' })
  display_name_question_id: string;

  @Column({ type: 'varchar', length: 255 })
  url: string;

  @Column({ type: 'bigint' })
  webhook_id: string;

  @OneToOne(() => Meetup, (meetup) => meetup.id)
  @JoinColumn({ name: 'meetup_id' })
  meetup: Meetup;
}
