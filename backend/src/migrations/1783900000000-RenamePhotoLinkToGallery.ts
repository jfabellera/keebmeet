import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePhotoLinkToGallery1783900000000 implements MigrationInterface {
    name = 'RenamePhotoLinkToGallery1783900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "photo_link_record" RENAME TO "gallery_record"`);
        await queryRunner.query(`ALTER TABLE "gallery_record" RENAME COLUMN "photo_link" TO "gallery"`);
        await queryRunner.query(`ALTER INDEX "UQ_photo_link_meetup_user" RENAME TO "UQ_gallery_meetup_user"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER INDEX "UQ_gallery_meetup_user" RENAME TO "UQ_photo_link_meetup_user"`);
        await queryRunner.query(`ALTER TABLE "gallery_record" RENAME COLUMN "gallery" TO "photo_link"`);
        await queryRunner.query(`ALTER TABLE "gallery_record" RENAME TO "photo_link_record"`);
    }

}
