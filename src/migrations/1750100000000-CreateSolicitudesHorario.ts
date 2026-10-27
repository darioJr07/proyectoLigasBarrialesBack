import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSolicitudesHorario1750100000000 implements MigrationInterface {
  name = 'CreateSolicitudesHorario1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS solicitudes_horario (
        id SERIAL PRIMARY KEY,
        liga_id INT NOT NULL REFERENCES ligas(id) ON DELETE RESTRICT,
        campeonato_id INT NOT NULL REFERENCES campeonatos(id) ON DELETE RESTRICT,
        categoria_id INT NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
        etapa VARCHAR(50) NOT NULL,
        equipo_id INT NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
        partido_id INT NOT NULL REFERENCES partidos(id) ON DELETE RESTRICT,
        fecha_solicitada DATE NOT NULL,
        hora_solicitada VARCHAR(10) NOT NULL,
        cancha_solicitada VARCHAR(150),
        motivo VARCHAR(500) NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        programacion_id INT REFERENCES programaciones_semanales(id) ON DELETE SET NULL,
        bolilla_id INT,
        solicitado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
        resuelto_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
        observacion_resolucion VARCHAR(500),
        resuelto_en TIMESTAMP,
        creado_en TIMESTAMP NOT NULL DEFAULT now(),
        actualizado_en TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT ck_solicitud_horario_estado CHECK (estado IN ('pendiente', 'aprobada', 'aplicada', 'rechazada', 'cancelada'))
      )
    `);
    await queryRunner.query(`ALTER TABLE programacion_bolillas ADD COLUMN IF NOT EXISTS solicitud_horario_id INT`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE programacion_bolillas
          ADD CONSTRAINT fk_bolilla_solicitud_horario
          FOREIGN KEY (solicitud_horario_id) REFERENCES solicitudes_horario(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE solicitudes_horario
          ADD CONSTRAINT fk_solicitud_horario_bolilla
          FOREIGN KEY (bolilla_id) REFERENCES programacion_bolillas(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_solicitudes_horario_filtros ON solicitudes_horario(campeonato_id, categoria_id, etapa, estado)');
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_horario_equipo_etapa_vigente
      ON solicitudes_horario(campeonato_id, categoria_id, etapa, equipo_id)
      WHERE estado IN ('pendiente', 'aprobada', 'aplicada')
    `);
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_bolilla_solicitud_horario ON programacion_bolillas(solicitud_horario_id) WHERE solicitud_horario_id IS NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_bolilla_solicitud_horario');
    await queryRunner.query('DROP INDEX IF EXISTS uq_solicitud_horario_equipo_etapa_vigente');
    await queryRunner.query('ALTER TABLE programacion_bolillas DROP CONSTRAINT IF EXISTS fk_bolilla_solicitud_horario');
    await queryRunner.query('ALTER TABLE programacion_bolillas DROP COLUMN IF EXISTS solicitud_horario_id');
    await queryRunner.query('DROP TABLE IF EXISTS solicitudes_horario');
  }
}
