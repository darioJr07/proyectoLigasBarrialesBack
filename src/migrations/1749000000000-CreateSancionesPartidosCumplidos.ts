import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSancionesPartidosCumplidos1749000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sanciones_partidos_cumplidos (
        id SERIAL PRIMARY KEY,
        sancion_id INT NOT NULL REFERENCES sanciones(id) ON DELETE CASCADE,
        partido_id INT NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
        estado_planilla VARCHAR(20) NULL,
        contabilizado_en TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_sancion_partido_cumplido UNIQUE (sancion_id, partido_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_sanciones_cumplidos_partido ON sanciones_partidos_cumplidos (partido_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS sanciones_partidos_cumplidos');
  }
}
