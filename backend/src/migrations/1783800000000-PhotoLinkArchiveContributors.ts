import { MigrationInterface, QueryRunner } from "typeorm";

export class PhotoLinkArchiveContributors1783800000000 implements MigrationInterface {
    name = 'PhotoLinkArchiveContributors1783800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Swap the composite (meetup_id, user_id) primary key for a surrogate id
        // so a meetup can hold many organizer-curated archive links.
        await queryRunner.query(`ALTER TABLE "photo_link_record" DROP CONSTRAINT "PK_a456755cd78d8574755af35e75e"`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" ADD "id" BIGSERIAL NOT NULL`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" ADD CONSTRAINT "PK_photo_link_record_id" PRIMARY KEY ("id")`);
        // Archive contributor links have no account; add a free-text credit.
        await queryRunner.query(`ALTER TABLE "photo_link_record" ALTER COLUMN "user_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" ADD "contributor_name" character varying(30)`);
        // Preserve the one-link-per-attendee rule for account-backed links only.
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_photo_link_meetup_user" ON "photo_link_record" ("meetup_id", "user_id") WHERE "user_id" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_photo_link_meetup_user"`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" DROP COLUMN "contributor_name"`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" ALTER COLUMN "user_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" DROP CONSTRAINT "PK_photo_link_record_id"`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" ADD CONSTRAINT "PK_a456755cd78d8574755af35e75e" PRIMARY KEY ("meetup_id", "user_id")`);
    }

}
