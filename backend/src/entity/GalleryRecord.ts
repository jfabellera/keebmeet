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

@Entity({ name: 'gallery_record' })
export class GalleryRecord extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  meetup_id: string;

  @ManyToOne(() => Meetup, (meetup) => meetup.id)
  @JoinColumn({ name: 'meetup_id' })
  meetup: Meetup;

  @Column({ type: 'bigint', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, (user) => user.id, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  contributor_name?: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: false })
  gallery: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;
}
