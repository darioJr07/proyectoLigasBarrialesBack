import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDerramas1748600000000 implements MigrationInterface {
  name = 'CreateDerramas1748600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Tabla derrama ───────────────────────────────────────────────────
    // Concepto general: ayuda económica, rifas, platos, etc.
    // Puede ser monetaria (monto fijo por equipo) o por unidades (precio unitario,
    // cada equipo elige cuántas toma).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS derrama (
        id               SERIAL PRIMARY KEY,
        liga_id          INT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
        campeonato_id    INT NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
        descripcion      VARCHAR(200) NOT NULL,
        tipo             VARCHAR(20) NOT NULL DEFAULT 'monetaria',
        monto_unitario   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        estado           VARCHAR(20) NOT NULL DEFAULT 'activa',
        creado_por       INT REFERENCES usuarios(id) ON DELETE SET NULL,
        creado_en        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_derrama_liga      ON derrama(liga_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_derrama_campeonato ON derrama(campeonato_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_derrama_estado    ON derrama(estado)`,
    );

    // ── 2. Tabla derrama_equipo ────────────────────────────────────────────
    // Un registro por equipo por derrama.
    // monto_total = cantidad × monto_unitario (calculado al crear).
    // monto_abonado acumula cada pago parcial o total.
    // modo_pago:
    //   'inmediato'  → el equipo paga ese momento, el tesorero lo registra directo
    //   'por_vocalia'→ en cada acta de partido se descuenta 1 unidad × monto_unitario
    // estado:
    //   pendiente  → no ha pagado nada
    //   parcial    → ha pagado algo pero no el total
    //   pagado     → cancelado completamente
    //   arrastrado → campeonato cerrado con deuda sin pagar
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS derrama_equipo (
        id                    SERIAL PRIMARY KEY,
        derrama_id            INT NOT NULL REFERENCES derrama(id) ON DELETE CASCADE,
        equipo_id             INT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
        campeonato_origen_id  INT REFERENCES campeonatos(id) ON DELETE SET NULL,
        cantidad              INT NOT NULL DEFAULT 1,
        monto_total           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        monto_abonado         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        modo_pago             VARCHAR(20) NOT NULL DEFAULT 'por_vocalia',
        estado                VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        observaciones         VARCHAR(500),
        actualizado_en        TIMESTAMP NOT NULL DEFAULT NOW(),
        creado_en             TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_derrama_equipo UNIQUE (derrama_id, equipo_id)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_derrama_equipo_derrama ON derrama_equipo(derrama_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_derrama_equipo_equipo  ON derrama_equipo(equipo_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_derrama_equipo_estado  ON derrama_equipo(estado)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS derrama_equipo`);
    await queryRunner.query(`DROP TABLE IF EXISTS derrama`);
  }
}
