import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Agrega el valor 'baja' al enum de estados de jugador_campeonatos.
 *
 * PostgreSQL no permite eliminar valores de un enum, pero sí agregar nuevos.
 * Con esto, al dar de baja a un jugador el registro queda con estado='baja'
 * en lugar de quedar en 'habilitado', lo cual mejora la claridad visual.
 *
 * La lógica de reutilización de fichas (recalificación con nuevo número) NO
 * se ve afectada, ya que esa lógica solo verifica activo=false, sin importar
 * el valor del campo estado.
 */
export class AddBajaToEstadoJugadorCampeonato1741900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // En PostgreSQL, los enums son tipos nombrados. TypeORM los crea con el
    // nombre: <tabla>_<columna>_enum → jugador_campeonatos_estado_enum
    await queryRunner.query(`
      ALTER TYPE jugador_campeonatos_estado_enum ADD VALUE IF NOT EXISTS 'baja'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL NO permite eliminar valores de un enum una vez creados.
    // Para revertir habría que recrear el tipo desde cero, lo cual requeriría
    // también migrar los datos. Por seguridad, el down solo deja una nota.
    // Si necesitas revertir, ejecuta manualmente:
    //
    //   ALTER TABLE jugador_campeonatos
    //     ALTER COLUMN estado TYPE varchar(20);
    //   DROP TYPE jugador_campeonatos_estado_enum;
    //   ALTER TABLE jugador_campeonatos
    //     ALTER COLUMN estado TYPE jugador_campeonatos_estado_enum
    //     USING estado::jugador_campeonatos_estado_enum;
    //
    // (previo a eso, actualiza los registros con estado='baja' al valor que corresponda)
    console.warn(
      'ATENCIÓN: El valor "baja" del enum no puede eliminarse automáticamente en PostgreSQL. ' +
      'Si necesitas revertir este cambio, hazlo de forma manual.'
    );
  }
}
