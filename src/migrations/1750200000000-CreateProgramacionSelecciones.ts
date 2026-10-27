import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProgramacionSelecciones1750200000000 implements MigrationInterface {
  name = 'CreateProgramacionSelecciones1750200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS programacion_selecciones (
        id SERIAL PRIMARY KEY,
        programacion_id INT NOT NULL REFERENCES programaciones_semanales(id) ON DELETE CASCADE,
        categoria_id INT REFERENCES categorias(id) ON DELETE RESTRICT,
        jornada INT NOT NULL,
        CONSTRAINT ck_programacion_seleccion_jornada CHECK (jornada > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_programacion_seleccion
      ON programacion_selecciones(programacion_id, categoria_id, jornada)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_programacion_selecciones_programacion
      ON programacion_selecciones(programacion_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_programacion_selecciones_busqueda
      ON programacion_selecciones(categoria_id, jornada)
    `);
    await queryRunner.query(`
      INSERT INTO programacion_selecciones (programacion_id, categoria_id, jornada)
      SELECT id, categoria_id, jornada
      FROM programaciones_semanales
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS programacion_selecciones');
  }
}
