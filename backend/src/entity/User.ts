import {
  BaseEntity,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Group } from './Group';
import { Ticket } from './Ticket';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  // bigint columns are returned by the pg driver as strings (and TypeORM relies
  // on that internally). Typing ids as `string` keeps the type honest so the
  // compiler flags any spot that assumes a number without coercing.
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  email: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 30 })
  first_name: string;

  @Column({ type: 'varchar', length: 30 })
  last_name: string;

  @Column({ type: 'varchar', length: 30 })
  nick_name: string;

  // R2 object key for the profile photo; '' means no photo. Served as a URL via
  // publicUrl() in the user DTO, mirroring meetups' image_key.
  @Column({ type: 'varchar', length: 255, default: '' })
  photo_key: string;

  @Column({ type: 'boolean', default: false })
  is_organizer: boolean;

  @Column({ type: 'boolean', default: false })
  is_admin: boolean;

  @Column({ type: 'boolean', default: false })
  is_owner: boolean;

  @Column({ type: 'varchar', length: 60, nullable: true })
  password_hash?: string;

  @Column({ type: 'varchar', length: 30, nullable: true, unique: true })
  discord_id?: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.user)
  tickets: Ticket[];

  @Column({ type: 'varchar', length: 96, nullable: true })
  encrypted_eventbrite_token?: string;

  @Column({ type: 'boolean', default: false })
  is_verified: boolean;

  @ManyToMany(() => Group)
  @JoinTable({
    name: 'users_groups',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'group_id', referencedColumnName: 'id' },
  })
  groups: Group[];
}
