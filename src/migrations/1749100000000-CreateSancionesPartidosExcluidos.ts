import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateSancionesPartidosExcluidos1749100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`CREATE TABLE sanciones_partidos_excluidos (id SERIAL PRIMARY KEY, sancion_id INT NOT NULL REFERENCES sanciones(id) ON DELETE CASCADE, partido_id INT NOT NULL REFERENCES partidos(id) ON DELETE CASCADE, excluido_en TIMESTAMP NOT NULL DEFAULT NOW(), CONSTRAINT uq_sancion_partido_excluido UNIQUE (sancion_id, partido_id))`); }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE IF EXISTS sanciones_partidos_excluidos'); }
}
