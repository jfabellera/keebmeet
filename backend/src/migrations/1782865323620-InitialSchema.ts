import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1782865323620 implements MigrationInterface {
    name = 'InitialSchema1782865323620'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "meetup_discord_message" ("id" BIGSERIAL NOT NULL, "guild_id" character varying(32) NOT NULL, "channel_id" character varying(32) NOT NULL, "message_id" character varying(32) NOT NULL, "meetup_id" bigint, CONSTRAINT "REL_33d05df2f024aa933a947b4846" UNIQUE ("meetup_id"), CONSTRAINT "PK_ec51fa3b7ebc9b6a34c33baf003" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "meetup_display_record" ("id" BIGSERIAL NOT NULL, "idle_image_urls" character varying(1024) array NOT NULL DEFAULT '{}', "raffle_background_url" character varying(1024), "batch_raffle_background_url" character varying(1024), "meetup_id" bigint, CONSTRAINT "REL_0ceb4aee26a99ad4fee79124d4" UNIQUE ("meetup_id"), CONSTRAINT "PK_8b3c53e152eb52aa5a7f95f1356" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" BIGSERIAL NOT NULL, "email" character varying(100) NOT NULL, "first_name" character varying(30) NOT NULL, "last_name" character varying(30) NOT NULL, "nick_name" character varying(30) NOT NULL, "is_organizer" boolean NOT NULL DEFAULT false, "is_admin" boolean NOT NULL DEFAULT false, "is_owner" boolean NOT NULL DEFAULT false, "password_hash" character varying(60), "discord_id" character varying(30), "encrypted_eventbrite_token" character varying(96), "is_verified" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_ecb6461da358b6d8a4f83d611a0" UNIQUE ("discord_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tickets" ("id" BIGSERIAL NOT NULL, "discord_id" character varying(32), "is_checked_in" boolean NOT NULL DEFAULT false, "raffle_entries" integer NOT NULL DEFAULT '0', "raffle_wins" integer NOT NULL DEFAULT '0', "ticket_holder_display_name" character varying NOT NULL DEFAULT '', "ticket_holder_first_name" character varying NOT NULL DEFAULT '', "ticket_holder_last_name" character varying NOT NULL DEFAULT '', "ticket_holder_email" character varying NOT NULL DEFAULT '', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "checked_in_at" TIMESTAMP WITH TIME ZONE, "checked_out_at" TIMESTAMP WITH TIME ZONE, "eventbrite_attendee_id" bigint, "meetup_id" bigint, "user_id" bigint, CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "raffle_winner" ("raffle_record_id" bigint NOT NULL, "ticket_id" bigint NOT NULL, "winner_number" integer NOT NULL, "claimed" boolean NOT NULL, CONSTRAINT "PK_36e04d9da1b3239a79bcca760fa" PRIMARY KEY ("raffle_record_id", "ticket_id"))`);
        await queryRunner.query(`CREATE TABLE "raffle_record" ("id" BIGSERIAL NOT NULL, "is_batch_roll" boolean NOT NULL, "was_displayed" boolean NOT NULL DEFAULT 'false', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "meetup_id" bigint, CONSTRAINT "PK_d5000a96a26bc56ae15d6d1886a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "meetups" ("id" BIGSERIAL NOT NULL, "name" character varying(100) NOT NULL, "date" TIMESTAMP WITH TIME ZONE NOT NULL, "has_raffle" boolean NOT NULL DEFAULT true, "capacity" integer NOT NULL, "duration_hours" integer NOT NULL, "address" character varying(255) NOT NULL, "city" character varying(100) NOT NULL, "state" character varying(50) NOT NULL, "country" character varying(100) NOT NULL, "utc_offset" integer NOT NULL, "image_url" character varying(255) NOT NULL, "description" character varying(500) NOT NULL DEFAULT '', "default_raffle_entries" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_6a9fcbc9b139c5daef2334f54cf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "eventbrite_record" ("id" BIGSERIAL NOT NULL, "event_id" bigint NOT NULL, "ticket_class_id" bigint NOT NULL, "display_name_question_id" bigint NOT NULL, "url" character varying(255) NOT NULL, "webhook_id" bigint NOT NULL, "meetup_id" bigint, CONSTRAINT "REL_bb9df2baa88fbd6ce3528fcb8f" UNIQUE ("meetup_id"), CONSTRAINT "PK_f0934ca9d0edfd91f741e184e4a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "organizer_request" ("id" BIGSERIAL NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" bigint, CONSTRAINT "REL_84edfc6973d52f6c85e37349c7" UNIQUE ("user_id"), CONSTRAINT "PK_0e1efa4f1d5f3707a6574f86036" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "meetups_organizers_users" ("meetupsId" bigint NOT NULL, "usersId" bigint NOT NULL, CONSTRAINT "PK_109e5aa8d359def2b2bcef1b6c2" PRIMARY KEY ("meetupsId", "usersId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_edfe3e61f7c09e171347915a2b" ON "meetups_organizers_users"  ("meetupsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ffbd7880622b157eaf12cc5d89" ON "meetups_organizers_users"  ("usersId") `);
        await queryRunner.query(`ALTER TABLE "meetup_discord_message" ADD CONSTRAINT "FK_33d05df2f024aa933a947b48461" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meetup_display_record" ADD CONSTRAINT "FK_0ceb4aee26a99ad4fee79124d47" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_de9b1d04a273b8c150a5461c452" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_2e445270177206a97921e461710" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "raffle_winner" ADD CONSTRAINT "FK_dd3d3fa4af06f970ee3d2ecb379" FOREIGN KEY ("raffle_record_id") REFERENCES "raffle_record"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "raffle_winner" ADD CONSTRAINT "FK_619f849fab88647b01fe5503b3b" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "raffle_record" ADD CONSTRAINT "FK_b36a066c11ab95b4fdab2ed3e7d" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "eventbrite_record" ADD CONSTRAINT "FK_bb9df2baa88fbd6ce3528fcb8f5" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organizer_request" ADD CONSTRAINT "FK_84edfc6973d52f6c85e37349c78" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meetups_organizers_users" ADD CONSTRAINT "FK_edfe3e61f7c09e171347915a2b6" FOREIGN KEY ("meetupsId") REFERENCES "meetups"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "meetups_organizers_users" ADD CONSTRAINT "FK_ffbd7880622b157eaf12cc5d89b" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "meetups_organizers_users" DROP CONSTRAINT "FK_ffbd7880622b157eaf12cc5d89b"`);
        await queryRunner.query(`ALTER TABLE "meetups_organizers_users" DROP CONSTRAINT "FK_edfe3e61f7c09e171347915a2b6"`);
        await queryRunner.query(`ALTER TABLE "organizer_request" DROP CONSTRAINT "FK_84edfc6973d52f6c85e37349c78"`);
        await queryRunner.query(`ALTER TABLE "eventbrite_record" DROP CONSTRAINT "FK_bb9df2baa88fbd6ce3528fcb8f5"`);
        await queryRunner.query(`ALTER TABLE "raffle_record" DROP CONSTRAINT "FK_b36a066c11ab95b4fdab2ed3e7d"`);
        await queryRunner.query(`ALTER TABLE "raffle_winner" DROP CONSTRAINT "FK_619f849fab88647b01fe5503b3b"`);
        await queryRunner.query(`ALTER TABLE "raffle_winner" DROP CONSTRAINT "FK_dd3d3fa4af06f970ee3d2ecb379"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_2e445270177206a97921e461710"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_de9b1d04a273b8c150a5461c452"`);
        await queryRunner.query(`ALTER TABLE "meetup_display_record" DROP CONSTRAINT "FK_0ceb4aee26a99ad4fee79124d47"`);
        await queryRunner.query(`ALTER TABLE "meetup_discord_message" DROP CONSTRAINT "FK_33d05df2f024aa933a947b48461"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ffbd7880622b157eaf12cc5d89"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_edfe3e61f7c09e171347915a2b"`);
        await queryRunner.query(`DROP TABLE "meetups_organizers_users"`);
        await queryRunner.query(`DROP TABLE "organizer_request"`);
        await queryRunner.query(`DROP TABLE "eventbrite_record"`);
        await queryRunner.query(`DROP TABLE "meetups"`);
        await queryRunner.query(`DROP TABLE "raffle_record"`);
        await queryRunner.query(`DROP TABLE "raffle_winner"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "meetup_display_record"`);
        await queryRunner.query(`DROP TABLE "meetup_discord_message"`);
    }

}
