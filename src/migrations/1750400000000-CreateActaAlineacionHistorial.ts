import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActaAlineacionHistorial1750400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_acta_alineacion_partido_jugador
        ON acta_alineacion (partido_id, jugador_id)
    `);

    await queryRunner.query(`
      CREATE TABLE acta_alineacion_historial (
        id                  SERIAL PRIMARY KEY,
        partido_id          INT NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
        campeonato_id       INT NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
        usuario_id          INT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
        motivo              VARCHAR(500) NOT NULL,
        alineacion_anterior JSONB NOT NULL,
        alineacion_nueva    JSONB NOT NULL,
        creado_en           TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_acta_alineacion_historial_partido
        ON acta_alineacion_historial (partido_id, creado_en)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS acta_alineacion_historial`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_acta_alineacion_partido_jugador`);
  }
}
