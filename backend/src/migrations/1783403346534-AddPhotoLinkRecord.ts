import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhotoLinkRecord1783403346534 implements MigrationInterface {
    name = 'AddPhotoLinkRecord1783403346534'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "photo_link_record" ("meetup_id" bigint NOT NULL, "user_id" bigint NOT NULL, "photo_link" character varying(1024) NOT NULL, CONSTRAINT "PK_a456755cd78d8574755af35e75e" PRIMARY KEY ("meetup_id", "user_id"))`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" ADD CONSTRAINT "FK_a97d0c22588992f817cf9258285" FOREIGN KEY ("meetup_id") REFERENCES "meetups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" ADD CONSTRAINT "FK_bae43ea00de1f857c7bbb166e34" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "photo_link_record" DROP CONSTRAINT "FK_bae43ea00de1f857c7bbb166e34"`);
        await queryRunner.query(`ALTER TABLE "photo_link_record" DROP CONSTRAINT "FK_a97d0c22588992f817cf9258285"`);
        await queryRunner.query(`DROP TABLE "photo_link_record"`);
    }

}
