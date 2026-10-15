import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCierresCajaTesoreria1749700000000 implements MigrationInterface {
  name = 'CreateCierresCajaTesoreria1749700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS cierres_caja_tesoreria (
        id SERIAL PRIMARY KEY,
        liga_id INT NOT NULL REFERENCES ligas(id) ON DELETE RESTRICT,
        campeonato_id INT NOT NULL REFERENCES campeonatos(id) ON DELETE RESTRICT,
        tipo VARCHAR(25) NOT NULL,
        fecha_desde DATE NOT NULL,
        fecha_corte DATE NOT NULL,
        cierre_anterior_id INT REFERENCES cierres_caja_tesoreria(id) ON DELETE RESTRICT,
        saldo_base NUMERIC(12, 2) NOT NULL,
        total_ingresos NUMERIC(12, 2) NOT NULL,
        total_egresos NUMERIC(12, 2) NOT NULL,
        saldo_esperado NUMERIC(12, 2) NOT NULL,
        saldo_contado NUMERIC(12, 2) NOT NULL,
        diferencia NUMERIC(12, 2) NOT NULL,
        observaciones VARCHAR(1000),
        creado_por_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT ck_cierre_caja_tipo CHECK (tipo IN ('conciliacion', 'cierre_definitivo')),
        CONSTRAINT uq_cierre_caja_fecha UNIQUE (campeonato_id, fecha_corte)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cierre_caja_definitivo
      ON cierres_caja_tesoreria (campeonato_id)
      WHERE tipo = 'cierre_definitivo'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cierre_caja_campeonato
      ON cierres_caja_tesoreria (campeonato_id, fecha_corte DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS cierres_caja_tesoreria');
  }
}
