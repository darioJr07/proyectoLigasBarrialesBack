import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Mejoras al módulo de sanciones para alinearlo con el reglamento.
 *
 * CAMBIOS:
 *
 * 1. reglas_sancion.descripcion (TEXT, nullable)
 *    → Permite escribir el literal exacto del reglamento en cada regla.
 *      Ej: "Art. 108 lit. A: Reincidir en falta estando previamente amonestado"
 *
 * 2. sanciones.regla_sancion_id (INT, nullable, FK → reglas_sancion)
 *    → Registra la causa/regla específica que justifica cada sanción.
 *      Nullable para no romper sanciones ya existentes.
 *
 * IMPACTO: Ninguna columna existente es modificada. Solo se agregan columnas
 * opcionales (nullable), por lo que los registros actuales no se ven afectados.
 */
export class AddDescripcionAndReglaSancionId1742700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Agregar descripcion a la tabla de reglas
    await queryRunner.query(`
      ALTER TABLE reglas_sancion
        ADD COLUMN IF NOT EXISTS descripcion TEXT NULL
    `);

    // 2. Agregar regla_sancion_id a la tabla de sanciones
    await queryRunner.query(`
      ALTER TABLE sanciones
        ADD COLUMN IF NOT EXISTS regla_sancion_id INT NULL
          REFERENCES reglas_sancion(id) ON DELETE SET NULL
    `);

    // Índice para acelerar búsquedas de sanciones por regla
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sanciones_regla_sancion_id
        ON sanciones(regla_sancion_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sanciones_regla_sancion_id`);
    await queryRunner.query(`ALTER TABLE sanciones DROP COLUMN IF EXISTS regla_sancion_id`);
    await queryRunner.query(`ALTER TABLE reglas_sancion DROP COLUMN IF EXISTS descripcion`);
  }
}
