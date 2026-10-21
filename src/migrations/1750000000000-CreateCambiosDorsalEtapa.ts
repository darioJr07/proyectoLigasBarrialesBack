import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCambiosDorsalEtapa1750000000000 implements MigrationInterface {
  name = 'CreateCambiosDorsalEtapa1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS jugador_campeonato_cambios_dorsal (
        id SERIAL PRIMARY KEY,
        jugador_campeonato_id INT NOT NULL REFERENCES jugador_campeonatos(id) ON DELETE RESTRICT,
        etapa_competencia_id INT NOT NULL REFERENCES etapas_competencia(id) ON DELETE RESTRICT,
        numero_cancha INT NOT NULL,
        jornada_desde INT NOT NULL,
        motivo VARCHAR(500) NOT NULL,
        registrado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
        activo BOOLEAN NOT NULL DEFAULT true,
        anulado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
        fecha_anulacion TIMESTAMP,
        motivo_anulacion VARCHAR(500),
        creado_en TIMESTAMP NOT NULL DEFAULT now(),
        actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT ck_cambio_dorsal_numero CHECK (numero_cancha BETWEEN 1 AND 99),
        CONSTRAINT ck_cambio_dorsal_jornada CHECK (jornada_desde BETWEEN 1 AND 3)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cambio_dorsal_activo_jugador_etapa
      ON jugador_campeonato_cambios_dorsal (jugador_campeonato_id, etapa_competencia_id)
      WHERE activo = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cambio_dorsal_etapa_consulta
      ON jugador_campeonato_cambios_dorsal (etapa_competencia_id, jornada_desde, activo)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS jugador_campeonato_cambios_dorsal');
  }
}
