import { MigrationInterface, QueryRunner } from "typeorm";

export class ArchiveMeetup1783646290831 implements MigrationInterface {
    name = 'ArchiveMeetup1783646290831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" ADD "is_archive" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD "organizer_name" character varying(30)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" DROP COLUMN "organizer_name"`);
        await queryRunner.query(`ALTER TABLE "meetups" DROP COLUMN "is_archive"`);
    }

}
