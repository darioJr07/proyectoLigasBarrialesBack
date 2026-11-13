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

-- 6. Reingresos con enlace incompleto o con una ficha origen que no corresponde.
SELECT
  nueva.id AS reingreso_id,
  nueva.jugador_id,
  nueva.campeonato_id,
  nueva.equipo_id,
  nueva.habilitacion_origen_id,
  origen.estado AS estado_origen,
  origen.activo AS origen_activo
FROM jugador_campeonatos nueva
LEFT JOIN jugador_campeonatos origen ON origen.id = nueva.habilitacion_origen_id
WHERE nueva.tipo_solicitud = 'reingreso'
  AND (
    nueva.habilitacion_origen_id IS NULL
    OR NULLIF(TRIM(nueva.motivo_reingreso), '') IS NULL
    OR origen.id IS NULL
    OR origen.estado <> 'baja'
    OR origen.activo = TRUE
    OR origen.jugador_id <> nueva.jugador_id
    OR origen.campeonato_id <> nueva.campeonato_id
    OR origen.equipo_id <> nueva.equipo_id
  )
ORDER BY nueva.id;

-- 7. Solicitudes activas que parecen reingresos historicos pero aun no estan vinculadas.
SELECT
  nueva.id AS solicitud_id,
  nueva.jugador_id,
  nueva.campeonato_id,
  nueva.equipo_id,
  MAX(baja.id) AS ultima_baja_id
FROM jugador_campeonatos nueva
INNER JOIN jugador_campeonatos baja
  ON baja.jugador_id = nueva.jugador_id
 AND baja.campeonato_id = nueva.campeonato_id
 AND baja.equipo_id = nueva.equipo_id
 AND baja.estado = 'baja'
 AND baja.activo = FALSE
 AND baja.id <> nueva.id
WHERE nueva.activo = TRUE
  AND nueva.estado IN ('pendiente', 'habilitado')
  AND COALESCE(nueva.tipo_solicitud, 'normal') <> 'reingreso'
GROUP BY nueva.id, nueva.jugador_id, nueva.campeonato_id, nueva.equipo_id
ORDER BY nueva.id;
