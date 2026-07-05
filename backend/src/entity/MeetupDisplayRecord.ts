import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Meetup } from './Meetup';

@Entity({ name: 'meetup_display_record' })
export class MeetupDisplayRecord extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @OneToOne(() => Meetup, (meetup) => meetup.id)
  @JoinColumn({ name: 'meetup_id' })
  meetup: Meetup;

  @Column({ type: 'varchar', length: 1024, array: true, default: '{}' })
  idle_image_urls: string[];

  @Column({ type: 'varchar', length: 1024, nullable: true })
  raffle_background_url: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  batch_raffle_background_url: string | null;
}
