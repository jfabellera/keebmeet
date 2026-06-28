import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

@Entity({ name: 'organizer_request' })
export class OrganizerRequest extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // OneToOne join column is unique → a user can have at most one pending request.
  @OneToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;
}
