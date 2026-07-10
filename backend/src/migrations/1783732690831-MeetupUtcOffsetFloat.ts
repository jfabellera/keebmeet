import { MigrationInterface, QueryRunner } from "typeorm";

export class MeetupUtcOffsetFloat1783732690831 implements MigrationInterface {
    name = 'MeetupUtcOffsetFloat1783732690831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" ALTER COLUMN "utc_offset" TYPE double precision`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" ALTER COLUMN "utc_offset" TYPE integer USING round("utc_offset")`);
    }

}
