import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxJugadoresHabilitadosToCampeonatos1740700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna max_jugadores_habilitados a campeonatos
    await queryRunner.query(`
      ALTER TABLE campeonatos 
      ADD COLUMN max_jugadores_habilitados INTEGER DEFAULT 20
    `);

    // Actualizar campeonatos existentes con el valor por defecto
    await queryRunner.query(`
      UPDATE campeonatos 
      SET max_jugadores_habilitados = 20 
      WHERE max_jugadores_habilitados IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir cambio
    await queryRunner.query(`
      ALTER TABLE campeonatos 
      DROP COLUMN max_jugadores_habilitados
    `);
  }
}
