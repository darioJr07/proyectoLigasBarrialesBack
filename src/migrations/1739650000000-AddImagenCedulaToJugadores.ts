import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImagenCedulaToJugadores1739650000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna imagen_cedula a jugadores
    await queryRunner.query(`
      ALTER TABLE jugadores 
      ADD COLUMN imagen_cedula VARCHAR(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir cambio
    await queryRunner.query(`
      ALTER TABLE jugadores 
      DROP COLUMN imagen_cedula
    `);
  }
}
