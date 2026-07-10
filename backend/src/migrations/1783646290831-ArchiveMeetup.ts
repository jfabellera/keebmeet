import { MigrationInterface, QueryRunner } from "typeorm";

export class ArchiveMeetup1783646290831 implements MigrationInterface {
    name = 'ArchiveMeetup1783646290831'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" DROP CONSTRAINT "FK_meetups_lead_organizer"`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD "is_archive" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD "archived_by" bigint`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD "organizer_name" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "meetups" ALTER COLUMN "lead_organizer" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD CONSTRAINT "CHK_548f0b88afb9171abee9c37ad1" CHECK ("is_archive" = true OR "lead_organizer" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD CONSTRAINT "FK_9654df8ead64c24862133a9814b" FOREIGN KEY ("lead_organizer") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" DROP CONSTRAINT "FK_9654df8ead64c24862133a9814b"`);
        await queryRunner.query(`ALTER TABLE "meetups" DROP CONSTRAINT "CHK_548f0b88afb9171abee9c37ad1"`);
        await queryRunner.query(`ALTER TABLE "meetups" ALTER COLUMN "lead_organizer" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meetups" DROP COLUMN "organizer_name"`);
        await queryRunner.query(`ALTER TABLE "meetups" DROP COLUMN "archived_by"`);
        await queryRunner.query(`ALTER TABLE "meetups" DROP COLUMN "is_archive"`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD CONSTRAINT "FK_meetups_lead_organizer" FOREIGN KEY ("lead_organizer") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
