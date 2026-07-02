import { MigrationInterface, QueryRunner } from "typeorm";

export class DurationHoursFloat1782963907165 implements MigrationInterface {
    name = 'DurationHoursFloat1782963907165'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" ALTER COLUMN "duration_hours" TYPE double precision`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" ALTER COLUMN "duration_hours" TYPE integer USING ceil("duration_hours")`);
    }

}
