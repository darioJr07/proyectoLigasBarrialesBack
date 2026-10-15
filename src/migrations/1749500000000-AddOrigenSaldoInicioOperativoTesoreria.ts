import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrigenSaldoInicioOperativoTesoreria1749500000000 implements MigrationInterface {
  name = 'AddOrigenSaldoInicioOperativoTesoreria1749500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inicio_operativo_tesoreria
        ADD COLUMN IF NOT EXISTS origen_saldo VARCHAR(20) NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS campeonato_origen_id INT REFERENCES campeonatos(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inicio_operativo_tesoreria
        DROP COLUMN IF EXISTS campeonato_origen_id,
        DROP COLUMN IF EXISTS origen_saldo
    `);
  }
}
