import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTag1784900000000 implements MigrationInterface {
  name = 'AddTag1784900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tags" ("id" BIGSERIAL NOT NULL, "name" character varying(100) NOT NULL, "color" character varying(7) NOT NULL, "created_by" bigint, CONSTRAINT "PK_tag_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tags_name_lower" ON "tags" (lower("name"))`
    );
    await queryRunner.query(
      `ALTER TABLE "tags" ADD CONSTRAINT "FK_tags_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tags" DROP CONSTRAINT "FK_tags_created_by"`
    );
    await queryRunner.query(`DROP INDEX "UQ_tags_name_lower"`);
    await queryRunner.query(`DROP TABLE "tags"`);
  }
}
