import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContactInfoToLigas1740427200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columnas correo y telefono a ligas
    await queryRunner.query(`
      ALTER TABLE ligas 
      ADD COLUMN correo VARCHAR(150),
      ADD COLUMN telefono VARCHAR(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir cambios
    await queryRunner.query(`
      ALTER TABLE ligas 
      DROP COLUMN correo,
      DROP COLUMN telefono
    `);
  }
}
