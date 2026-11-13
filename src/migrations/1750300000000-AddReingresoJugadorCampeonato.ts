import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReingresoJugadorCampeonato1750300000000 implements MigrationInterface {
  name = 'AddReingresoJugadorCampeonato1750300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE jugador_campeonatos
        ADD COLUMN IF NOT EXISTS tipo_solicitud varchar(20) NOT NULL DEFAULT 'normal',
        ADD COLUMN IF NOT EXISTS habilitacion_origen_id int NULL,
        ADD COLUMN IF NOT EXISTS motivo_reingreso varchar(500) NULL,
        ADD COLUMN IF NOT EXISTS referencia_reingreso varchar(200) NULL,
        ADD COLUMN IF NOT EXISTS fecha_baja timestamp NULL,
        ADD COLUMN IF NOT EXISTS dado_baja_por int NULL,
        ADD COLUMN IF NOT EXISTS motivo_baja varchar(500) NULL,
        ADD COLUMN IF NOT EXISTS referencia_baja varchar(200) NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE jugador_campeonatos
          ADD CONSTRAINT fk_jugador_campeonatos_habilitacion_origen
          FOREIGN KEY (habilitacion_origen_id) REFERENCES jugador_campeonatos(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE jugador_campeonatos
          ADD CONSTRAINT fk_jugador_campeonatos_dado_baja_por
          FOREIGN KEY (dado_baja_por) REFERENCES usuarios(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_jugador_campeonatos_habilitacion_origen
      ON jugador_campeonatos (habilitacion_origen_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_jugador_campeonatos_tipo_solicitud
      ON jugador_campeonatos (tipo_solicitud)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_jugador_campeonatos_tipo_solicitud');
    await queryRunner.query('DROP INDEX IF EXISTS idx_jugador_campeonatos_habilitacion_origen');
    await queryRunner.query('ALTER TABLE jugador_campeonatos DROP CONSTRAINT IF EXISTS fk_jugador_campeonatos_dado_baja_por');
    await queryRunner.query('ALTER TABLE jugador_campeonatos DROP CONSTRAINT IF EXISTS fk_jugador_campeonatos_habilitacion_origen');
    await queryRunner.query(`
      ALTER TABLE jugador_campeonatos
        DROP COLUMN IF EXISTS referencia_baja,
        DROP COLUMN IF EXISTS motivo_baja,
        DROP COLUMN IF EXISTS dado_baja_por,
        DROP COLUMN IF EXISTS fecha_baja,
        DROP COLUMN IF EXISTS referencia_reingreso,
        DROP COLUMN IF EXISTS motivo_reingreso,
        DROP COLUMN IF EXISTS habilitacion_origen_id,
        DROP COLUMN IF EXISTS tipo_solicitud
    `);
  }
}
