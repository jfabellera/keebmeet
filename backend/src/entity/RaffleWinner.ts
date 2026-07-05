import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { RaffleRecord } from './RaffleRecord';
import { Ticket } from './Ticket';

@Entity({ name: 'raffle_winner' })
export class RaffleWinner extends BaseEntity {
  @PrimaryColumn()
  raffle_record_id: string;

  @ManyToOne(() => RaffleRecord, (raffleRecord) => raffleRecord.id)
  @JoinColumn({ name: 'raffle_record_id' })
  raffle_record: RaffleRecord;

  @PrimaryColumn()
  ticket_id: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.id)
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ type: 'int' })
  winner_number: number;

  @Column({ type: 'boolean' })
  claimed: boolean;
}
