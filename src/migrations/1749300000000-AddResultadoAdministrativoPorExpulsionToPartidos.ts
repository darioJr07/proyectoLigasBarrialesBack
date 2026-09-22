import { MigrationInterface, QueryRunner } from 'typeorm';

/** Marca los resultados administrativos originados por la expulsión de un equipo. */
export class AddResultadoAdministrativoPorExpulsionToPartidos1749300000000 implements MigrationInterface {
  name = 'AddResultadoAdministrativoPorExpulsionToPartidos1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE partidos
       ADD COLUMN IF NOT EXISTS resultado_administrativo_por_expulsion BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE partidos DROP COLUMN IF EXISTS resultado_administrativo_por_expulsion`,
    );
  }
}
