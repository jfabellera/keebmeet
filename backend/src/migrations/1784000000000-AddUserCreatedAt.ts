import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserCreatedAt1784000000000 implements MigrationInterface {
    name = 'AddUserCreatedAt1784000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "created_at"`);
    }

}
