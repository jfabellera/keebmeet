import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGroups1784600000000 implements MigrationInterface {
  name = 'AddUserGroups1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users_groups" ("user_id" bigint NOT NULL, "group_id" bigint NOT NULL, CONSTRAINT "PK_users_groups" PRIMARY KEY ("user_id", "group_id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_groups_user" ON "users_groups" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_groups_group" ON "users_groups" ("group_id")`
    );
    await queryRunner.query(
      `ALTER TABLE "users_groups" ADD CONSTRAINT "FK_users_groups_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "users_groups" ADD CONSTRAINT "FK_users_groups_group" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users_groups" DROP CONSTRAINT "FK_users_groups_group"`
    );
    await queryRunner.query(
      `ALTER TABLE "users_groups" DROP CONSTRAINT "FK_users_groups_user"`
    );
    await queryRunner.query(`DROP INDEX "IDX_users_groups_group"`);
    await queryRunner.query(`DROP INDEX "IDX_users_groups_user"`);
    await queryRunner.query(`DROP TABLE "users_groups"`);
  }
}
