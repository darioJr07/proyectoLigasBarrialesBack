import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEtapasCompetenciaGrupos1749800000000 implements MigrationInterface {
  name = 'CreateEtapasCompetenciaGrupos1749800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS etapas_competencia (
        id SERIAL PRIMARY KEY,
        campeonato_id INT NOT NULL REFERENCES campeonatos(id) ON DELETE RESTRICT,
        categoria_id INT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
        nombre VARCHAR(50) NOT NULL,
        orden INT NOT NULL DEFAULT 1,
        formato VARCHAR(40) NOT NULL DEFAULT 'tabla_unica',
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        activo BOOLEAN NOT NULL DEFAULT true,
        creado_en TIMESTAMP NOT NULL DEFAULT now(),
        actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_etapa_competencia_nombre UNIQUE (campeonato_id, categoria_id, nombre),
        CONSTRAINT ck_etapa_competencia_formato CHECK (formato IN ('tabla_unica', 'grupos_cruce_descansos')),
        CONSTRAINT ck_etapa_competencia_estado CHECK (estado IN ('pendiente', 'actual', 'finalizada'))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_etapa_actual_categoria
      ON etapas_competencia (campeonato_id, categoria_id)
      WHERE estado = 'actual' AND activo = true
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS etapas_grupos (
        id SERIAL PRIMARY KEY,
        etapa_competencia_id INT NOT NULL REFERENCES etapas_competencia(id) ON DELETE CASCADE,
        nombre VARCHAR(40) NOT NULL,
        orden INT NOT NULL DEFAULT 1,
        activo BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT uq_etapa_grupo_nombre UNIQUE (etapa_competencia_id, nombre)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS etapas_grupos_equipos (
        id SERIAL PRIMARY KEY,
        grupo_id INT NOT NULL REFERENCES etapas_grupos(id) ON DELETE CASCADE,
        equipo_id INT NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
        orden INT NOT NULL DEFAULT 1,
        activo BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT uq_etapa_grupo_equipo UNIQUE (grupo_id, equipo_id)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS etapas_grupos_bonificaciones (
        id SERIAL PRIMARY KEY,
        grupo_equipo_id INT NOT NULL REFERENCES etapas_grupos_equipos(id) ON DELETE CASCADE,
        puntos INT NOT NULL,
        etapa_origen VARCHAR(50),
        posicion_origen INT,
        motivo VARCHAR(250) NOT NULL,
        creado_por_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
        activo BOOLEAN NOT NULL DEFAULT true,
        creado_en TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT ck_etapa_grupo_bonificacion_puntos CHECK (puntos > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_etapas_competencia_consulta
      ON etapas_competencia (campeonato_id, categoria_id, orden)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_etapas_grupos_equipos_equipo
      ON etapas_grupos_equipos (equipo_id)
    `);

    // Registra como historial las etapas que ya existen, sin modificar sus partidos.
    await queryRunner.query(`
      INSERT INTO etapas_competencia
        (campeonato_id, categoria_id, nombre, orden, formato, estado, activo)
      SELECT etapas.campeonato_id, etapas.categoria_id, etapas.etapa,
             ROW_NUMBER() OVER (
               PARTITION BY etapas.campeonato_id, etapas.categoria_id
               ORDER BY etapas.primer_partido_id
             )::int,
             'tabla_unica', 'finalizada', true
      FROM (
        SELECT campeonato_id, categoria_id, etapa, MIN(id) AS primer_partido_id
        FROM partidos
        WHERE activo = true
        GROUP BY campeonato_id, categoria_id, etapa
      ) etapas
      ON CONFLICT (campeonato_id, categoria_id, nombre) DO NOTHING
    `);

    // La etapa creada más recientemente queda seleccionada como actual.
    // El primer UPDATE permite ejecutar la migración también sobre una base
    // donde synchronize ya hubiese creado y usado estas tablas.
    await queryRunner.query(`
      UPDATE etapas_competencia
      SET estado = 'finalizada'
      WHERE estado = 'actual'
    `);
    await queryRunner.query(`
      UPDATE etapas_competencia etapa
      SET estado = 'actual'
      WHERE etapa.id IN (
        SELECT DISTINCT ON (campeonato_id, categoria_id) id
        FROM etapas_competencia
        WHERE activo = true
        ORDER BY campeonato_id, categoria_id, orden DESC, id DESC
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS etapas_grupos_bonificaciones');
    await queryRunner.query('DROP TABLE IF EXISTS etapas_grupos_equipos');
    await queryRunner.query('DROP TABLE IF EXISTS etapas_grupos');
    await queryRunner.query('DROP TABLE IF EXISTS etapas_competencia');
  }
}
