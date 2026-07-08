import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGarantias1748500000000 implements MigrationInterface {
  name = 'CreateGarantias1748500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Tabla garantia_equipo ───────────────────────────────────────────
    // Garantía económica que cada equipo deposita al ingresar a la liga.
    // Un equipo solo puede tener una garantía activa (pendiente/pagada) por liga.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS garantia_equipo (
        id          SERIAL PRIMARY KEY,
        liga_id     INT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
        equipo_id   INT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
        monto       DECIMAL(10,2) NOT NULL DEFAULT 100.00,
        estado      VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        motivo_resolucion TEXT,
        campeonato_id     INT REFERENCES campeonatos(id) ON DELETE SET NULL,
        registrado_por    INT REFERENCES usuarios(id) ON DELETE SET NULL,
        resuelto_por      INT REFERENCES usuarios(id) ON DELETE SET NULL,
        fecha_resolucion  TIMESTAMP,
        creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_garantia_equipo_liga ON garantia_equipo(liga_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_garantia_equipo_equipo ON garantia_equipo(equipo_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_garantia_equipo_estado ON garantia_equipo(estado)`,
    );

    // ── 2. Tabla prestamo_fondo_garantias ─────────────────────────────────
    // Registro de préstamos tomados del fondo colectivo de garantías.
    // Al tomar: crea un movimiento_tesoreria tipo ingreso/garantia en caja.
    // Al devolver: crea un movimiento_tesoreria tipo egreso/garantia en caja.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS prestamo_fondo_garantias (
        id              SERIAL PRIMARY KEY,
        liga_id         INT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
        monto           DECIMAL(10,2) NOT NULL,
        motivo          TEXT NOT NULL,
        estado          VARCHAR(20) NOT NULL DEFAULT 'tomado',
        campeonato_id   INT REFERENCES campeonatos(id) ON DELETE SET NULL,
        movimiento_ingreso_id INT REFERENCES movimiento_tesoreria(id) ON DELETE SET NULL,
        movimiento_egreso_id  INT REFERENCES movimiento_tesoreria(id) ON DELETE SET NULL,
        registrado_por  INT REFERENCES usuarios(id) ON DELETE SET NULL,
        devuelto_por    INT REFERENCES usuarios(id) ON DELETE SET NULL,
        fecha_devolucion TIMESTAMP,
        creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_prestamo_fondo_liga ON prestamo_fondo_garantias(liga_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_prestamo_fondo_estado ON prestamo_fondo_garantias(estado)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS prestamo_fondo_garantias`);
    await queryRunner.query(`DROP TABLE IF EXISTS garantia_equipo`);
  }
}
