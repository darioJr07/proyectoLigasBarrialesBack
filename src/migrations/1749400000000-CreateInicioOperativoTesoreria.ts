import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInicioOperativoTesoreria1749400000000 implements MigrationInterface {
  name = 'CreateInicioOperativoTesoreria1749400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inicio_operativo_tesoreria (
        id              SERIAL PRIMARY KEY,
        liga_id         INT NOT NULL REFERENCES ligas(id) ON DELETE CASCADE,
        campeonato_id   INT NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
        fecha_inicio    DATE NOT NULL,
        saldo_inicial   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        creado_por      INT REFERENCES usuarios(id) ON DELETE SET NULL,
        creado_en       TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_inicio_operativo_tesoreria_campeonato UNIQUE (campeonato_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_inicio_operativo_tesoreria_liga ON inicio_operativo_tesoreria(liga_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_inicio_operativo_tesoreria_liga`);
    await queryRunner.query(`DROP TABLE IF EXISTS inicio_operativo_tesoreria`);
  }
}
