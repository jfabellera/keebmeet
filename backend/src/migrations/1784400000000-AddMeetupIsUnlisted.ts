import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetupIsUnlisted1784400000000 implements MigrationInterface {
  name = 'AddMeetupIsUnlisted1784400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meetups" ADD "is_unlisted" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meetups" DROP COLUMN "is_unlisted"`
    );
  }
}
