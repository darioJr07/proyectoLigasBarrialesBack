import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTesoreria1748000000000 implements MigrationInterface {
  name = 'CreateTesoreria1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Campo cuota_inscripcion en campeonatos ──────────────────────────
    await queryRunner.query(
      `ALTER TABLE campeonatos
       ADD COLUMN IF NOT EXISTS cuota_inscripcion DECIMAL(10,2) NOT NULL DEFAULT 0.00`,
    );

    // ── 2. Tabla config_vocalia ────────────────────────────────────────────
    // Almacena los valores fijos del acta de vocalía por liga.
    // Reemplaza el array hardcodeado en acta-imprimir.component.ts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS config_vocalia (
        id         SERIAL PRIMARY KEY,
        liga_id    INT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
        nombre     VARCHAR(100) NOT NULL,
        monto      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        orden      INT NOT NULL DEFAULT 0,
        activo     BOOLEAN NOT NULL DEFAULT true,
        creado_en  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_config_vocalia_liga ON config_vocalia(liga_id)`,
    );

    // ── 3. Tabla cobro_partido ─────────────────────────────────────────────
    // Un registro por equipo por partido (local y visitante por separado).
    // Se genera desde el acta digital cuando el vocal guarda los valores.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cobro_partido (
        id                      SERIAL PRIMARY KEY,
        partido_id              INT NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
        equipo_id               INT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
        campeonato_id           INT NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
        liga_id                 INT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
        jornada                 INT,
        monto_arbitraje         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        monto_aporte_liga       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        monto_premios           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        monto_fondo_accidentes  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        monto_limpieza          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        monto_tarjetas          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        extras_json             JSONB,
        total                   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        estado                  VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        fecha_pago              DATE,
        observaciones           VARCHAR(500),
        creado_por              INT REFERENCES usuarios(id) ON DELETE SET NULL,
        creado_en               TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_cobro_partido_equipo UNIQUE (partido_id, equipo_id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cobro_partido_campeonato ON cobro_partido(campeonato_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cobro_partido_equipo ON cobro_partido(equipo_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_cobro_partido_estado ON cobro_partido(estado)`,
    );

    // ── 4. Tabla movimiento_tesoreria ──────────────────────────────────────
    // Caja general: ingresos y egresos que NO vienen de un partido.
    // equipo_id es opcional: si es un cobro a equipo (inscripción, carnets, multa)
    // se llena; si es un gasto general (árbitros, trofeos) se deja null.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS movimiento_tesoreria (
        id                  SERIAL PRIMARY KEY,
        liga_id             INT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
        campeonato_id       INT REFERENCES campeonatos(id) ON DELETE SET NULL,
        equipo_id           INT REFERENCES equipos(id) ON DELETE SET NULL,
        tipo                VARCHAR(10) NOT NULL,
        categoria           VARCHAR(30) NOT NULL DEFAULT 'otro',
        descripcion         VARCHAR(500),
        monto               DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        estado              VARCHAR(20) NOT NULL DEFAULT 'pagado',
        fecha_vencimiento   DATE,
        fecha_pago          DATE,
        comprobante         VARCHAR(100),
        origen_automatico   BOOLEAN NOT NULL DEFAULT false,
        creado_por          INT REFERENCES usuarios(id) ON DELETE SET NULL,
        creado_en           TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_movimiento_liga ON movimiento_tesoreria(liga_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_movimiento_campeonato ON movimiento_tesoreria(campeonato_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_movimiento_equipo ON movimiento_tesoreria(equipo_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_movimiento_estado ON movimiento_tesoreria(estado)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimiento_estado`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimiento_equipo`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimiento_campeonato`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimiento_liga`);
    await queryRunner.query(`DROP TABLE IF EXISTS movimiento_tesoreria`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_cobro_partido_estado`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cobro_partido_equipo`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cobro_partido_campeonato`);
    await queryRunner.query(`DROP TABLE IF EXISTS cobro_partido`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_config_vocalia_liga`);
    await queryRunner.query(`DROP TABLE IF EXISTS config_vocalia`);

    await queryRunner.query(
      `ALTER TABLE campeonatos DROP COLUMN IF EXISTS cuota_inscripcion`,
    );
  }
}
