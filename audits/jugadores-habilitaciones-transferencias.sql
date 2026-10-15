-- Auditoria de solo lectura: jugadores, habilitaciones y transferencias.
-- Todas las sentencias son SELECT. Este archivo no modifica datos ni estructura.

-- 1. Mas de una habilitacion activa para el mismo jugador y campeonato.
SELECT
  jugador_id,
  campeonato_id,
  COUNT(*) AS habilitaciones_activas,
  ARRAY_AGG(id ORDER BY id) AS registros
FROM jugador_campeonatos
WHERE activo = TRUE
GROUP BY jugador_id, campeonato_id
HAVING COUNT(*) > 1
ORDER BY campeonato_id, jugador_id;

-- 2. Dorsales activos repetidos dentro del mismo equipo y campeonato.
SELECT
  campeonato_id,
  equipo_id,
  numero_cancha,
  COUNT(*) AS cantidad,
  ARRAY_AGG(id ORDER BY id) AS registros,
  ARRAY_AGG(jugador_id ORDER BY jugador_id) AS jugadores
FROM jugador_campeonatos
WHERE activo = TRUE
GROUP BY campeonato_id, equipo_id, numero_cancha
HAVING COUNT(*) > 1
ORDER BY campeonato_id, equipo_id, numero_cancha;

-- 3. Mas de una transferencia realmente en proceso para un jugador/campeonato.
WITH transferencias_en_proceso AS (
  SELECT *
  FROM transferencias
  WHERE activo = TRUE
    AND (
      estado_equipo_origen = 'pendiente'
      OR (
        estado_equipo_origen = 'aprobado'
        AND estado_directivo = 'pendiente'
      )
    )
)
SELECT
  jugador_id,
  campeonato_id,
  COUNT(*) AS solicitudes_en_proceso,
  ARRAY_AGG(id ORDER BY id) AS registros
FROM transferencias_en_proceso
GROUP BY jugador_id, campeonato_id
HAVING COUNT(*) > 1
ORDER BY campeonato_id, jugador_id;

-- 4. Habilitaciones activas cuyo equipo no coincide con el equipo actual del jugador.
SELECT
  jc.id AS habilitacion_id,
  jc.jugador_id,
  jc.campeonato_id,
  jc.equipo_id AS equipo_habilitacion,
  j.equipo_id AS equipo_actual_jugador,
  jc.estado
FROM jugador_campeonatos jc
INNER JOIN jugadores j ON j.id = jc.jugador_id
WHERE jc.activo = TRUE
  AND jc.equipo_id IS DISTINCT FROM j.equipo_id
ORDER BY jc.campeonato_id, jc.jugador_id;

-- 5. Resumen de registros por estado para facilitar la revision manual.
SELECT
  estado,
  activo,
  COUNT(*) AS cantidad
FROM jugador_campeonatos
GROUP BY estado, activo
ORDER BY estado, activo DESC;

SELECT
  estado_equipo_origen,
  estado_directivo,
  activo,
  COUNT(*) AS cantidad
FROM transferencias
GROUP BY estado_equipo_origen, estado_directivo, activo
ORDER BY estado_equipo_origen, estado_directivo, activo DESC;
