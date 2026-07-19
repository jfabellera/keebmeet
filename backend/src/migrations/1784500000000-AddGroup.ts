import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroup1784500000000 implements MigrationInterface {
  name = 'AddGroup1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "groups" ("id" BIGSERIAL NOT NULL, "name" character varying(100) NOT NULL, "code" character varying(30) NOT NULL, "discord_server_id" character varying(32), CONSTRAINT "UQ_group_code" UNIQUE ("code"), CONSTRAINT "PK_group_id" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "groups"`);
  }
}
