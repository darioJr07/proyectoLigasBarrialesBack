import { MigrationInterface, QueryRunner } from 'typeorm';

/** Descuento definitivo decidido por el Tribunal para una sanción concreta. */
export class AddPuntosDescuentoAplicadoToSanciones1749200000000 implements MigrationInterface {
  name = 'AddPuntosDescuentoAplicadoToSanciones1749200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE sanciones
       ADD COLUMN IF NOT EXISTS puntos_descuento_aplicado INT NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE sanciones DROP COLUMN IF EXISTS puntos_descuento_aplicado`,
    );
  }
}
