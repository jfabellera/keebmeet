import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMeetupLeadOrganizer1783400000000 implements MigrationInterface {
    name = 'AddMeetupLeadOrganizer1783400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" ADD "lead_organizer" bigint`);
        // Backfill existing meetups: the original creator wasn't tracked, so pick
        // a deterministic organizer (lowest user id) as the lead. Every meetup is
        // created with at least its creator as an organizer.
        await queryRunner.query(`UPDATE "meetups" SET "lead_organizer" = (SELECT MIN("usersId") FROM "meetups_organizers_users" WHERE "meetupsId" = "meetups"."id")`);
        await queryRunner.query(`ALTER TABLE "meetups" ALTER COLUMN "lead_organizer" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD CONSTRAINT "FK_meetups_lead_organizer" FOREIGN KEY ("lead_organizer") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" DROP CONSTRAINT "FK_meetups_lead_organizer"`);
        await queryRunner.query(`ALTER TABLE "meetups" DROP COLUMN "lead_organizer"`);
    }

}
