import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMeetupTags1785000000000 implements MigrationInterface {
  name = 'AddMeetupTags1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "meetups_tags" ("meetup_id" bigint NOT NULL, "tag_id" bigint NOT NULL, CONSTRAINT "PK_meetups_tags" PRIMARY KEY ("meetup_id", "tag_id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meetups_tags_meetup" ON "meetups_tags" ("meetup_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meetups_tags_tag" ON "meetups_tags" ("tag_id")`
    );
    await queryRunner.query(
      `ALTER TABLE "meetups_tags" ADD CONSTRAINT "FK_meetups_tags_meetup" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "meetups_tags" ADD CONSTRAINT "FK_meetups_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meetups_tags" DROP CONSTRAINT "FK_meetups_tags_tag"`
    );
    await queryRunner.query(
      `ALTER TABLE "meetups_tags" DROP CONSTRAINT "FK_meetups_tags_meetup"`
    );
    await queryRunner.query(`DROP INDEX "IDX_meetups_tags_tag"`);
    await queryRunner.query(`DROP INDEX "IDX_meetups_tags_meetup"`);
    await queryRunner.query(`DROP TABLE "meetups_tags"`);
  }
}
