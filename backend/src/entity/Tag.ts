import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

@Entity({ name: 'tags' })
export class Tag extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  // Unique case-insensitively via a functional index on lower(name).
  @Column({ type: 'varchar', length: 100 })
  name: string;

  // Hex color code, e.g. #1a2b3c
  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ type: 'bigint', nullable: true })
  created_by: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User | null;
}
