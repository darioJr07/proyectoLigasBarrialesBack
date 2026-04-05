import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrigenSancionId1743900000000 implements MigrationInterface {
  name = 'AddOrigenSancionId1743900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // FK self-referenciante: indica de qué sanción original fue arrastrada esta
    await queryRunner.query(
      `ALTER TABLE sanciones
       ADD COLUMN IF NOT EXISTS origen_sancion_id INT NULL
       REFERENCES sanciones(id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sanciones DROP COLUMN IF EXISTS origen_sancion_id`);
  }
}
