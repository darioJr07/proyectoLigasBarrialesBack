import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea la tabla acta_alineacion para registrar la participación
 * de cada jugador en cada partido (planilla digital del acta de vocalía).
 */
export class CreateActaAlineacion1743000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE acta_alineacion (
        id            SERIAL PRIMARY KEY,
        partido_id    INT NOT NULL REFERENCES partidos(id) ON DELETE CASCADE,
        campeonato_id INT NOT NULL REFERENCES campeonatos(id) ON DELETE CASCADE,
        equipo_id     INT NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
        jugador_id    INT NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
        estado        VARCHAR(20) NOT NULL DEFAULT 'jugo'
                        CHECK (estado IN ('jugo','no_jugo','suspendido','ausente','lesionado','expulsado')),
        numero_cancha INT NULL,
        observaciones VARCHAR(300) NULL,
        activo        BOOLEAN NOT NULL DEFAULT true,
        creado_en     TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Índice principal: buscar toda la planilla de un partido
    await queryRunner.query(`
      CREATE INDEX idx_acta_alineacion_partido_id
        ON acta_alineacion (partido_id)
    `);

    // Índice para consultas de historial de un jugador
    await queryRunner.query(`
      CREATE INDEX idx_acta_alineacion_jugador_id
        ON acta_alineacion (jugador_id)
    `);

    // Índice para contar partidos cumplidos de un jugador en un campeonato
    await queryRunner.query(`
      CREATE INDEX idx_acta_alineacion_campeonato_jugador
        ON acta_alineacion (campeonato_id, jugador_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS acta_alineacion`);
  }
}
