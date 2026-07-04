import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPhotoKey1783300000000 implements MigrationInterface {
    name = 'AddUserPhotoKey1783300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "photo_key" character varying(255) NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "photo_key"`);
    }

}
