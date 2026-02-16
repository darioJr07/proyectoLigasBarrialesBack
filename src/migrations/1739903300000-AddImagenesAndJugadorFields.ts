import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImagenesAndJugadorFields1739903300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar columna imagen a ligas
    await queryRunner.query(`
      ALTER TABLE ligas 
      ADD COLUMN imagen VARCHAR(500)
    `);

    // Agregar columna imagen a equipos
    await queryRunner.query(`
      ALTER TABLE equipos 
      ADD COLUMN imagen VARCHAR(500)
    `);

    // Agregar columnas a jugadores
    await queryRunner.query(`
      ALTER TABLE jugadores 
      ADD COLUMN imagen VARCHAR(500),
      ADD COLUMN numero_cancha INT,
      ADD COLUMN posicion VARCHAR(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir cambios en jugadores
    await queryRunner.query(`
      ALTER TABLE jugadores 
      DROP COLUMN posicion,
      DROP COLUMN numero_cancha,
      DROP COLUMN imagen
    `);

    // Revertir cambios en equipos
    await queryRunner.query(`
      ALTER TABLE equipos 
      DROP COLUMN imagen
    `);

    // Revertir cambios en ligas
    await queryRunner.query(`
      ALTER TABLE ligas 
      DROP COLUMN imagen
    `);
  }
}
