import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGalleryOverrides1784800000000 implements MigrationInterface {
  name = 'AddGalleryOverrides1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_record" ADD "title" character varying(200)`
    );
    await queryRunner.query(
      `ALTER TABLE "gallery_record" ADD "cover_image_key" character varying(1024)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_record" DROP COLUMN "cover_image_key"`
    );
    await queryRunner.query(`ALTER TABLE "gallery_record" DROP COLUMN "title"`);
  }
}
