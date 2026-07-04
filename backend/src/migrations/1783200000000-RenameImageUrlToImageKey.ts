import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameImageUrlToImageKey1783200000000 implements MigrationInterface {
    name = 'RenameImageUrlToImageKey1783200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" RENAME COLUMN "image_url" TO "image_key"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" RENAME COLUMN "image_key" TO "image_url"`);
    }

}
