import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificaciones1750500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id SERIAL PRIMARY KEY,
        usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        liga_id INT NULL,
        equipo_id INT NULL,
        tipo VARCHAR(60) NOT NULL,
        titulo VARCHAR(160) NOT NULL,
        mensaje VARCHAR(600) NOT NULL,
        ruta VARCHAR(250) NULL,
        referencia_tipo VARCHAR(60) NULL,
        referencia_id INT NULL,
        clave_evento VARCHAR(180) NULL,
        leida BOOLEAN NOT NULL DEFAULT FALSE,
        fecha_lectura TIMESTAMP NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_estado_fecha
        ON notificaciones (usuario_id, leida, creado_en DESC)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_notificaciones_usuario_clave
        ON notificaciones (usuario_id, clave_evento)
        WHERE clave_evento IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS notificaciones');
  }
}
