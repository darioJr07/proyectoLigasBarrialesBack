import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Crea la tabla 'goles' para el módulo de goleadores.
 *
 * PROPÓSITO:
 * Permite registrar cada gol de forma individual, vinculado a:
 *   - partido_id   → en qué partido se marcó
 *   - jugador_id   → quién lo anotó
 *   - equipo_id    → a qué equipo beneficia el gol (en autogoles, el equipo rival)
 *   - campeonato_id / categoria_id → contexto del campeonato
 *
 * La columna categoria_id se guarda directamente en el gol (no solo en el partido)
 * para proteger el historial ante ascensos/descensos a mitad de campeonato.
 */
export class CreateGoles1742600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE goles (
        id              SERIAL PRIMARY KEY,
        partido_id      INT NOT NULL
          REFERENCES partidos(id) ON DELETE CASCADE,
        jugador_id      INT NOT NULL
          REFERENCES jugadores(id),
        equipo_id       INT NOT NULL
          REFERENCES equipos(id),
        campeonato_id   INT NOT NULL
          REFERENCES campeonatos(id),
        categoria_id    INT NOT NULL
          REFERENCES categorias(id),
        minuto          INT,
        tipo            VARCHAR(20) NOT NULL DEFAULT 'normal',
        activo          BOOLEAN NOT NULL DEFAULT true,
        creado_en       TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Índices para acelerar las consultas más frecuentes:
    //   - Goles de un partido (para eliminar/reemplazar al editar resultado)
    //   - Goles por campeonato+categoría (para calcular tabla de goleadores)
    await queryRunner.query(`
      CREATE INDEX idx_goles_partido_id
        ON goles(partido_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_goles_campeonato_categoria
        ON goles(campeonato_id, categoria_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_goles_jugador_id
        ON goles(jugador_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS goles`);
  }
}
