import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Meetup } from './Meetup';
import { User } from './User';

@Entity({ name: 'photo_link_record' })
export class PhotoLinkRecord extends BaseEntity {
  @PrimaryColumn({ type: 'bigint' })
  meetup_id: string;

  @ManyToOne(() => Meetup, (meetup) => meetup.id)
  @JoinColumn({ name: 'meetup_id' })
  meetup: Meetup;

  @PrimaryColumn({ type: 'bigint' })
  user_id: string;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 1024, nullable: false })
  photo_link: string;
}
