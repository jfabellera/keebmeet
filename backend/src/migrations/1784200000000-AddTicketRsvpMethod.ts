import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketRsvpMethod1784200000000 implements MigrationInterface {
    name = 'AddTicketRsvpMethod1784200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // New column defaults to 'keebmeet'; controllers set it explicitly at
        // creation from here on, so it stays authoritative for new rows.
        await queryRunner.query(
            `ALTER TABLE "tickets" ADD "rsvp_method" character varying(16) NOT NULL DEFAULT 'keebmeet'`
        );

        // Backfill existing rows. Eventbrite and account-less Discord RSVPs are
        // recoverable from the data. The remaining bucket — discord_id set AND a
        // user linked — is genuinely ambiguous: the old createTicket stamped the
        // requestor's discord_id on web RSVPs, so those are indistinguishable
        // from real Discord-button RSVPs by a linked user. They fall through to
        // the 'keebmeet' default, which is the more common source in that window.
        await queryRunner.query(
            `UPDATE "tickets" SET "rsvp_method" = 'eventbrite' WHERE "eventbrite_attendee_id" IS NOT NULL`
        );
        await queryRunner.query(
            `UPDATE "tickets" SET "rsvp_method" = 'discord' WHERE "discord_id" IS NOT NULL AND "user_id" IS NULL`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "rsvp_method"`);
    }
}
