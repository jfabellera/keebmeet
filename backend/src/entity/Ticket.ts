import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Meetup } from './Meetup';
import { User } from './User';

@Entity({ name: 'tickets' })
export class Ticket extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ManyToOne(() => Meetup, (meetup) => meetup.id)
  @JoinColumn({ name: 'meetup_id' })
  meetup: Meetup;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'boolean', default: false })
  is_checked_in: boolean;

  @Column({ type: 'int', default: 0 })
  raffle_entries: number;

  @Column({ type: 'int', default: 0 })
  raffle_wins: number;

  @Column({ type: 'varchar', default: '' })
  ticket_holder_display_name: string;

  @Column({ type: 'varchar', default: '' })
  ticket_holder_first_name: string;

  @Column({ type: 'varchar', default: '' })
  ticket_holder_last_name: string;

  @Column({ type: 'varchar', default: '' })
  ticket_holder_email: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @Column({ type: 'timestamptz', default: null, nullable: true })
  checked_in_at: Date;

  @Column({ type: 'timestamptz', default: null, nullable: true })
  checked_out_at: Date;

  @Column({ type: 'bigint', default: null, nullable: true })
  eventbrite_attendee_id?: number;
}
