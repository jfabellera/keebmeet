import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllowRsvpToMeetupDiscordMessage1784075219803
    implements MigrationInterface
{
    name = 'AddAllowRsvpToMeetupDiscordMessage1784075219803'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Default true so existing announcements keep the RSVP button they were
        // posted with.
        await queryRunner.query(
            `ALTER TABLE "meetup_discord_message" ADD "allow_rsvp" boolean NOT NULL DEFAULT true`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "meetup_discord_message" DROP COLUMN "allow_rsvp"`
        );
    }
}
