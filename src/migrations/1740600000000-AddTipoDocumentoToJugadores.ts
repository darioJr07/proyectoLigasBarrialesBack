import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTipoDocumentoToJugadores1740600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna tipo_documento a jugadores
    await queryRunner.query(`
      ALTER TABLE jugadores 
      ADD COLUMN tipo_documento VARCHAR(20) DEFAULT 'Cédula'
    `);

    // Actualizar todos los registros existentes para que tengan tipo_documento = 'Cédula'
    await queryRunner.query(`
      UPDATE jugadores 
      SET tipo_documento = 'Cédula' 
      WHERE tipo_documento IS NULL OR tipo_documento = ''
    `);

    // Hacer el campo NOT NULL después de actualizar los registros existentes
    await queryRunner.query(`
      ALTER TABLE jugadores 
      ALTER COLUMN tipo_documento SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir cambio
    await queryRunner.query(`
      ALTER TABLE jugadores 
      DROP COLUMN tipo_documento
    `);
  }
}
