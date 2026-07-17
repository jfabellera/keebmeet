import { MigrationInterface, QueryRunner } from 'typeorm';
import { usernamify } from '../util/username';

export class AddUserUsername1784310000000 implements MigrationInterface {
  name = 'AddUserUsername1784310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "username" character varying(30)`
    );

    // Backfill from nick_name (else email). Dedupe against this pass's Set.
    const rows: { id: string; nick_name: string; email: string }[] =
      await queryRunner.query(`SELECT id, nick_name, email FROM users`);
    const used = new Set<string>();
    for (const row of rows) {
      const seed =
        row.nick_name != null && row.nick_name.trim() !== ''
          ? row.nick_name
          : row.email;
      const base = usernamify(seed);
      let candidate = base;
      let n = 1;
      while (used.has(candidate)) {
        n += 1;
        candidate = `${base}-${n}`;
      }
      used.add(candidate);
      await queryRunner.query(`UPDATE users SET username = $1 WHERE id = $2`, [
        candidate,
        row.id,
      ]);
    }

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_username"`
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
  }
}
