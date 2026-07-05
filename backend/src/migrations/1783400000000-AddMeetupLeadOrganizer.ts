import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMeetupLeadOrganizer1783400000000 implements MigrationInterface {
    name = 'AddMeetupLeadOrganizer1783400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups" ADD "lead_organizer" bigint`);
        // Backfill existing meetups: the original creator wasn't tracked, so pick
        // a deterministic organizer (lowest user id) as the lead. Every meetup is
        // created with at least its creator as an organizer.
        await queryRunner.query(`UPDATE "meetups" SET "lead_organizer" = (SELECT MIN("usersId") FROM "meetups_organizers_users" WHERE "meetupsId" = "meetups"."id")`);
        // The `organizers` join table holds co-organizers only, so drop the lead's
        // row from it (the lead now lives in the lead_organizer column).
        await queryRunner.query(`DELETE FROM "meetups_organizers_users" WHERE ("meetupsId", "usersId") IN (SELECT "id", "lead_organizer" FROM "meetups")`);
        await queryRunner.query(`ALTER TABLE "meetups" ALTER COLUMN "lead_organizer" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "meetups" ADD CONSTRAINT "FK_meetups_lead_organizer" FOREIGN KEY ("lead_organizer") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Put each lead back into the organizers join table before dropping the
        // column, so the co-organizers-only invariant is reversed cleanly.
        await queryRunner.query(`INSERT INTO "meetups_organizers_users" ("meetupsId", "usersId") SELECT "id", "lead_organizer" FROM "meetups" WHERE "lead_organizer" IS NOT NULL ON CONFLICT DO NOTHING`);
        await queryRunner.query(`ALTER TABLE "meetups" DROP CONSTRAINT "FK_meetups_lead_organizer"`);
        await queryRunner.query(`ALTER TABLE "meetups" DROP COLUMN "lead_organizer"`);
    }

}
