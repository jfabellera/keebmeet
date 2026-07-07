import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Meetup } from './Meetup';
import { RaffleWinner } from './RaffleWinner';

@Entity({ name: 'raffle_record' })
export class RaffleRecord extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'boolean' })
  is_batch_roll: boolean;

  @OneToMany(() => RaffleWinner, (winner) => winner.raffle_record)
  winners: RaffleWinner[];

  @Column({ type: 'boolean', default: false })
  was_displayed: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @ManyToOne(() => Meetup, (meetup) => meetup.id)
  @JoinColumn({ name: 'meetup_id' })
  meetup: Meetup;
}
