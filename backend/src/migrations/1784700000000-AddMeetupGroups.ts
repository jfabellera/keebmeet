import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetupGroups1784700000000 implements MigrationInterface {
  name = 'AddMeetupGroups1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "meetups_groups" ("meetup_id" bigint NOT NULL, "group_id" bigint NOT NULL, CONSTRAINT "PK_meetups_groups" PRIMARY KEY ("meetup_id", "group_id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meetups_groups_meetup" ON "meetups_groups" ("meetup_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meetups_groups_group" ON "meetups_groups" ("group_id")`
    );
    await queryRunner.query(
      `ALTER TABLE "meetups_groups" ADD CONSTRAINT "FK_meetups_groups_meetup" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "meetups_groups" ADD CONSTRAINT "FK_meetups_groups_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meetups_groups" DROP CONSTRAINT "FK_meetups_groups_group"`
    );
    await queryRunner.query(
      `ALTER TABLE "meetups_groups" DROP CONSTRAINT "FK_meetups_groups_meetup"`
    );
    await queryRunner.query(`DROP INDEX "IDX_meetups_groups_group"`);
    await queryRunner.query(`DROP INDEX "IDX_meetups_groups_meetup"`);
    await queryRunner.query(`DROP TABLE "meetups_groups"`);
  }
}
