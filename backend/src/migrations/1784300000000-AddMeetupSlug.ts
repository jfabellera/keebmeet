import { MigrationInterface, QueryRunner } from 'typeorm';
import { slugify } from '../util/slug';

export class AddMeetupSlug1784300000000 implements MigrationInterface {
  name = 'AddMeetupSlug1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meetups" ADD "slug" character varying(120)`
    );

    // Backfill from the name. The table has no slugs yet, so dedupe against the
    // slugs assigned in this pass (a Set), appending -2, -3, … on a clash.
    const rows: { id: string; name: string }[] = await queryRunner.query(
      `SELECT id, name FROM meetups`
    );
    const used = new Set<string>();
    for (const row of rows) {
      const base = slugify(row.name);
      let candidate = base;
      let n = 1;
      while (used.has(candidate)) {
        n += 1;
        candidate = `${base}-${n}`;
      }
      used.add(candidate);
      await queryRunner.query(`UPDATE meetups SET slug = $1 WHERE id = $2`, [
        candidate,
        row.id,
      ]);
    }

    await queryRunner.query(
      `ALTER TABLE "meetups" ALTER COLUMN "slug" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "meetups" ADD CONSTRAINT "UQ_meetups_slug" UNIQUE ("slug")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meetups" DROP CONSTRAINT "UQ_meetups_slug"`
    );
    await queryRunner.query(`ALTER TABLE "meetups" DROP COLUMN "slug"`);
  }
}
