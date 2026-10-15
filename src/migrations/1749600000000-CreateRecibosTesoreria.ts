import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRecibosTesoreria1749600000000 implements MigrationInterface {
  name = 'CreateRecibosTesoreria1749600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recibos_tesoreria (
        id SERIAL PRIMARY KEY,
        liga_id INT NOT NULL REFERENCES ligas(id) ON DELETE RESTRICT,
        campeonato_id INT REFERENCES campeonatos(id) ON DELETE SET NULL,
        equipo_id INT NOT NULL REFERENCES equipos(id) ON DELETE RESTRICT,
        numero VARCHAR(30) NOT NULL,
        anio INT NOT NULL,
        secuencial INT NOT NULL,
        origen VARCHAR(30) NOT NULL,
        origen_id INT NOT NULL,
        movimiento_id INT,
        concepto VARCHAR(500) NOT NULL,
        monto NUMERIC(10, 2) NOT NULL,
        fecha_pago DATE NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'emitido',
        emitido_por_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_recibos_tesoreria_secuencia UNIQUE (liga_id, anio, secuencial)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_recibos_tesoreria_origen
      ON recibos_tesoreria (origen, origen_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_recibos_tesoreria_equipo
      ON recibos_tesoreria (liga_id, equipo_id, fecha_pago)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS recibos_tesoreria');
  }
}
