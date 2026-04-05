import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModoCastigoToSanciones1743800000000 implements MigrationInterface {
  name = 'AddModoCastigoToSanciones1743800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── reglas_sancion: modo de castigo y duración en meses ────────────────
    await queryRunner.query(
      `ALTER TABLE reglas_sancion
       ADD COLUMN IF NOT EXISTS modo_castigo VARCHAR(10) NOT NULL DEFAULT 'partidos'`,
    );
    await queryRunner.query(
      `ALTER TABLE reglas_sancion
       ADD COLUMN IF NOT EXISTS duracion_meses INT NULL`,
    );

    // ── sanciones: rango de fechas para suspensiones por tiempo ───────────
    await queryRunner.query(
      `ALTER TABLE sanciones
       ADD COLUMN IF NOT EXISTS fecha_inicio_suspension DATE NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE sanciones
       ADD COLUMN IF NOT EXISTS fecha_fin_suspension DATE NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sanciones DROP COLUMN IF EXISTS fecha_fin_suspension`);
    await queryRunner.query(`ALTER TABLE sanciones DROP COLUMN IF EXISTS fecha_inicio_suspension`);
    await queryRunner.query(`ALTER TABLE reglas_sancion DROP COLUMN IF EXISTS duracion_meses`);
    await queryRunner.query(`ALTER TABLE reglas_sancion DROP COLUMN IF EXISTS modo_castigo`);
  }
}
