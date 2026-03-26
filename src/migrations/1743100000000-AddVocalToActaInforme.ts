import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega vocal_nombre y vocal_equipo_id a acta_informe_partido.
 *
 * - vocal_nombre: texto libre (nombre del equipo, jugador o directivo vocal)
 * - vocal_equipo_id: FK opcional al equipo al que pertenece el vocal
 *   (útil para trazabilidad y sanciones por ausencia o error del vocal)
 */
export class AddVocalToActaInforme1743100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE acta_informe_partido
        ADD COLUMN IF NOT EXISTS vocal_nombre VARCHAR(200) NULL,
        ADD COLUMN IF NOT EXISTS vocal_equipo_id INT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE acta_informe_partido
        ADD CONSTRAINT fk_acta_informe_vocal_equipo
        FOREIGN KEY (vocal_equipo_id) REFERENCES equipos(id)
        ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE acta_informe_partido
        DROP CONSTRAINT IF EXISTS fk_acta_informe_vocal_equipo;
    `);
    await queryRunner.query(`
      ALTER TABLE acta_informe_partido
        DROP COLUMN IF EXISTS vocal_nombre,
        DROP COLUMN IF EXISTS vocal_equipo_id;
    `);
  }
}
