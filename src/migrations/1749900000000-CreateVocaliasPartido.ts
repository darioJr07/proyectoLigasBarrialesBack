import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVocaliasPartido1749900000000 implements MigrationInterface {
  name = 'CreateVocaliasPartido1749900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vocalias_partido (
        id SERIAL PRIMARY KEY,
        programacion_id INT NOT NULL REFERENCES programaciones_semanales(id) ON DELETE CASCADE,
        partido_id INT NOT NULL REFERENCES partidos(id) ON DELETE RESTRICT,
        partido_origen_id INT REFERENCES partidos(id) ON DELETE RESTRICT,
        tipo_asignacion VARCHAR(20) NOT NULL DEFAULT 'sorteo',
        regla_asignacion VARCHAR(20) NOT NULL DEFAULT 'normal',
        equipo_extractor_id INT REFERENCES equipos(id) ON DELETE RESTRICT,
        resultado_bolilla VARCHAR(2),
        equipo_vocal_id INT REFERENCES equipos(id) ON DELETE RESTRICT,
        directivo_nombre VARCHAR(200),
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        creado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
        confirmado_en TIMESTAMP,
        creado_en TIMESTAMP NOT NULL DEFAULT now(),
        actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_vocalia_partido UNIQUE (partido_id),
        CONSTRAINT ck_vocalia_tipo CHECK (tipo_asignacion IN ('sorteo', 'manual_equipo', 'directivo')),
        CONSTRAINT ck_vocalia_regla CHECK (regla_asignacion IN ('normal', 'cierre_tres', 'manual')),
        CONSTRAINT ck_vocalia_resultado CHECK (resultado_bolilla IS NULL OR resultado_bolilla IN ('si', 'no')),
        CONSTRAINT ck_vocalia_estado CHECK (estado IN ('pendiente', 'asignada', 'confirmada'))
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_vocalias_programacion ON vocalias_partido(programacion_id)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS vocalias_partido');
  }
}
