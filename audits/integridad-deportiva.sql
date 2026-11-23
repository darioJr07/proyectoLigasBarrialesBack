-- Auditoria integral de solo lectura.
-- Cada bloque devuelve exclusivamente los registros que requieren revision.
-- Un resultado vacio significa que el control no encontro novedades.

-- AUDIT: JH01|error|Mas de una habilitacion vigente para el mismo jugador y campeonato
SELECT jugador_id, campeonato_id, COUNT(*) AS cantidad,
       ARRAY_AGG(id ORDER BY id) AS registros
FROM jugador_campeonatos
WHERE activo = TRUE AND estado IN ('pendiente', 'habilitado')
GROUP BY jugador_id, campeonato_id
HAVING COUNT(*) > 1
ORDER BY campeonato_id, jugador_id;

-- AUDIT: JH02|error|Habilitacion vigente en un equipo distinto al equipo actual del jugador
SELECT jc.id AS habilitacion_id, jc.jugador_id, jc.campeonato_id,
       jc.equipo_id AS equipo_habilitacion, j.equipo_id AS equipo_actual, jc.estado
FROM jugador_campeonatos jc
JOIN jugadores j ON j.id = jc.jugador_id
WHERE jc.activo = TRUE
  AND jc.estado IN ('pendiente', 'habilitado')
  AND jc.equipo_id IS DISTINCT FROM j.equipo_id
ORDER BY jc.campeonato_id, jc.jugador_id;

-- AUDIT: JH03|error|Reingreso sin baja anterior valida o sin motivo
SELECT nueva.id AS reingreso_id, nueva.jugador_id, nueva.campeonato_id,
       nueva.equipo_id, nueva.habilitacion_origen_id,
       origen.estado AS estado_origen, origen.activo AS origen_activo
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

-- AUDIT: JH04|advertencia|Solicitud vigente con baja anterior que no esta identificada como reingreso
SELECT nueva.id AS solicitud_id, nueva.jugador_id, nueva.campeonato_id,
       nueva.equipo_id, MAX(baja.id) AS ultima_baja_id
FROM jugador_campeonatos nueva
JOIN jugador_campeonatos baja
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

-- AUDIT: JH05|error|Habilitacion vigente sin inscripcion confirmada del equipo en su categoria
SELECT jc.id AS habilitacion_id, jc.jugador_id, jc.campeonato_id,
       jc.categoria_id, jc.equipo_id, jc.estado
FROM jugador_campeonatos jc
WHERE jc.activo = TRUE
  AND jc.estado IN ('pendiente', 'habilitado')
  AND NOT EXISTS (
    SELECT 1
    FROM inscripciones i
    WHERE i.campeonato_id = jc.campeonato_id
      AND i.categoria_id = jc.categoria_id
      AND i.equipo_id = jc.equipo_id
      AND i.activo = TRUE
      AND i.estado = 'confirmada'
  )
ORDER BY jc.campeonato_id, jc.equipo_id, jc.jugador_id;

-- AUDIT: JH06|error|Ficha con estado y datos de baja incoherentes
SELECT id, jugador_id, campeonato_id, equipo_id, estado, activo,
       fecha_baja, dado_baja_por, motivo_baja
FROM jugador_campeonatos
WHERE (estado = 'baja' AND activo = TRUE)
   OR (estado <> 'baja' AND fecha_baja IS NOT NULL)
ORDER BY id;

-- AUDIT: JH08|advertencia|Baja historica anterior a la auditoria detallada sin fecha registrada
SELECT campeonato_id, COUNT(*) AS cantidad,
       MIN(id) AS primer_registro, MAX(id) AS ultimo_registro
FROM jugador_campeonatos
WHERE estado = 'baja' AND activo = FALSE AND fecha_baja IS NULL
GROUP BY campeonato_id
ORDER BY campeonato_id;

-- AUDIT: JH07|error|Equipo que supera el cupo de jugadores vigente del campeonato
SELECT jc.campeonato_id, jc.equipo_id, e.nombre AS equipo,
       COUNT(*) AS jugadores_ocupando_cupo,
       COUNT(*) FILTER (WHERE jc.estado = 'habilitado') AS habilitados,
       COUNT(*) FILTER (WHERE jc.estado = 'pendiente') AS pendientes,
       COUNT(*) FILTER (WHERE jc.tipo_solicitud = 'reingreso') AS reingresos,
       MAX(jc.fecha_aprobacion) AS ultima_aprobacion,
       c.max_jugadores_habilitados AS cupo_maximo,
       ARRAY_AGG(jc.id ORDER BY jc.id) AS registros
FROM jugador_campeonatos jc
JOIN campeonatos c ON c.id = jc.campeonato_id
JOIN equipos e ON e.id = jc.equipo_id
WHERE jc.activo = TRUE AND jc.estado IN ('pendiente', 'habilitado')
GROUP BY jc.campeonato_id, jc.equipo_id, e.nombre, c.max_jugadores_habilitados
HAVING c.max_jugadores_habilitados IS NOT NULL
   AND COUNT(*) > c.max_jugadores_habilitados
ORDER BY jc.campeonato_id, jc.equipo_id;

-- AUDIT: DO01|error|Mas de un cambio de dorsal activo para la misma habilitacion y etapa
SELECT jugador_campeonato_id, etapa_competencia_id, COUNT(*) AS cantidad,
       ARRAY_AGG(id ORDER BY id) AS registros
FROM jugador_campeonato_cambios_dorsal
WHERE activo = TRUE
GROUP BY jugador_campeonato_id, etapa_competencia_id
HAVING COUNT(*) > 1
ORDER BY jugador_campeonato_id, etapa_competencia_id;

-- AUDIT: DO02|error|Cambio de dorsal con jornada fuera del plazo o etapa incompatible
SELECT cd.id, cd.jugador_campeonato_id, cd.etapa_competencia_id,
       cd.jornada_desde, jc.campeonato_id AS campeonato_habilitacion,
       jc.categoria_id AS categoria_habilitacion,
       ec.campeonato_id AS campeonato_etapa, ec.categoria_id AS categoria_etapa
FROM jugador_campeonato_cambios_dorsal cd
JOIN jugador_campeonatos jc ON jc.id = cd.jugador_campeonato_id
JOIN etapas_competencia ec ON ec.id = cd.etapa_competencia_id
WHERE cd.jornada_desde NOT BETWEEN 1 AND 3
   OR jc.campeonato_id <> ec.campeonato_id
   OR jc.categoria_id <> ec.categoria_id
ORDER BY cd.id;

-- AUDIT: DO03|error|Dorsal nuevo repetido entre cambios activos del mismo equipo y etapa
SELECT jc.equipo_id, cd.etapa_competencia_id, cd.numero_cancha,
       COUNT(*) AS cantidad, ARRAY_AGG(cd.id ORDER BY cd.id) AS cambios
FROM jugador_campeonato_cambios_dorsal cd
JOIN jugador_campeonatos jc ON jc.id = cd.jugador_campeonato_id
WHERE cd.activo = TRUE AND jc.activo = TRUE
GROUP BY jc.equipo_id, cd.etapa_competencia_id, cd.numero_cancha
HAVING COUNT(*) > 1
ORDER BY jc.equipo_id, cd.etapa_competencia_id, cd.numero_cancha;

-- AUDIT: DO04|error|Dorsal nuevo ocupado por otra habilitacion cuando inicia el cambio
SELECT cd.id AS cambio_id, cd.etapa_competencia_id, cd.jornada_desde,
       titular.equipo_id, cd.numero_cancha, otro.id AS habilitacion_conflicto
FROM jugador_campeonato_cambios_dorsal cd
JOIN jugador_campeonatos titular ON titular.id = cd.jugador_campeonato_id
JOIN jugador_campeonatos otro
  ON otro.campeonato_id = titular.campeonato_id
 AND otro.equipo_id = titular.equipo_id
 AND otro.id <> titular.id
 AND otro.activo = TRUE
 AND otro.estado IN ('pendiente', 'habilitado')
 AND otro.numero_cancha = cd.numero_cancha
WHERE cd.activo = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM jugador_campeonato_cambios_dorsal liberacion
    WHERE liberacion.jugador_campeonato_id = otro.id
      AND liberacion.etapa_competencia_id = cd.etapa_competencia_id
      AND liberacion.activo = TRUE
      AND liberacion.jornada_desde <= cd.jornada_desde
  )
ORDER BY cd.id, otro.id;

-- AUDIT: TR01|error|Mas de una transferencia en proceso para el mismo jugador y campeonato
WITH en_proceso AS (
  SELECT * FROM transferencias
  WHERE activo = TRUE
    AND (estado_equipo_origen = 'pendiente'
      OR (estado_equipo_origen = 'aprobado' AND estado_directivo = 'pendiente'))
)
SELECT jugador_id, campeonato_id, COUNT(*) AS cantidad,
       ARRAY_AGG(id ORDER BY id) AS registros
FROM en_proceso
GROUP BY jugador_id, campeonato_id
HAVING COUNT(*) > 1
ORDER BY campeonato_id, jugador_id;

-- AUDIT: TR02|error|Transferencia con el mismo equipo como origen y destino
SELECT id, jugador_id, campeonato_id, equipo_origen_id, equipo_destino_id
FROM transferencias
WHERE equipo_origen_id = equipo_destino_id
ORDER BY id;

-- AUDIT: TR03|error|Transferencia completada cuyo jugador no pertenece al equipo destino
WITH completadas AS (
  SELECT t.*,
         ROW_NUMBER() OVER (
           PARTITION BY t.jugador_id, t.campeonato_id
           ORDER BY t.fecha_solicitud DESC, t.id DESC
         ) AS orden
  FROM transferencias t
  WHERE t.activo = TRUE
    AND t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
)
SELECT t.id, t.jugador_id, t.campeonato_id, t.equipo_origen_id,
       t.equipo_destino_id, j.equipo_id AS equipo_actual
FROM completadas t
JOIN jugadores j ON j.id = t.jugador_id
WHERE t.orden = 1
  AND j.equipo_id IS DISTINCT FROM t.equipo_destino_id
ORDER BY t.id;

-- AUDIT: TR04|error|Transferencia completada que conserva una habilitacion activa en el origen
WITH completadas AS (
  SELECT t.*,
         ROW_NUMBER() OVER (
           PARTITION BY t.jugador_id, t.campeonato_id
           ORDER BY t.fecha_solicitud DESC, t.id DESC
         ) AS orden
  FROM transferencias t
  WHERE t.activo = TRUE
    AND t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
)
SELECT t.id AS transferencia_id, jc.id AS habilitacion_origen_activa,
       t.jugador_id, t.campeonato_id, t.equipo_origen_id
FROM completadas t
JOIN jugador_campeonatos jc
  ON jc.jugador_id = t.jugador_id
 AND jc.campeonato_id = t.campeonato_id
 AND jc.equipo_id = t.equipo_origen_id
 AND jc.activo = TRUE
 AND jc.estado IN ('pendiente', 'habilitado')
WHERE t.orden = 1
ORDER BY t.id, jc.id;

-- AUDIT: SA01|error|Sancion con mas partidos auditados que su contador guardado
SELECT s.id AS sancion_id, s.jugador_id, s.campeonato_id,
       s.partidos_cumplidos, COUNT(spc.id) AS registros_cumplidos
FROM sanciones s
LEFT JOIN sanciones_partidos_cumplidos spc ON spc.sancion_id = s.id
WHERE s.partidos_suspension > 0
GROUP BY s.id, s.jugador_id, s.campeonato_id, s.partidos_cumplidos
HAVING COUNT(spc.id) > s.partidos_cumplidos
ORDER BY s.id;

-- AUDIT: SA06|advertencia|Contador historico de sancion sin trazabilidad completa por partido
SELECT s.campeonato_id, COUNT(*) AS sanciones,
       SUM(s.partidos_cumplidos - trazados.cantidad) AS cumplimientos_sin_detalle,
       MIN(s.id) AS primera_sancion, MAX(s.id) AS ultima_sancion
FROM sanciones s
JOIN LATERAL (
  SELECT COUNT(*)::int AS cantidad
  FROM sanciones_partidos_cumplidos spc
  WHERE spc.sancion_id = s.id
) trazados ON TRUE
WHERE s.partidos_suspension > 0
  AND s.partidos_cumplidos > trazados.cantidad
GROUP BY s.campeonato_id
ORDER BY s.campeonato_id;

-- AUDIT: SA02|error|Partido no jugado contabilizado como cumplimiento de una sancion
SELECT spc.id, spc.sancion_id, spc.partido_id, p.estado,
       p.fecha_partido, p.jornada
FROM sanciones_partidos_cumplidos spc
JOIN partidos p ON p.id = spc.partido_id
WHERE p.estado <> 'jugado' OR p.activo = FALSE
ORDER BY spc.sancion_id, spc.partido_id;

-- AUDIT: SA03|error|Mismo partido marcado simultaneamente como cumplido y excluido
SELECT c.sancion_id, c.partido_id, c.id AS cumplimiento_id, e.id AS exclusion_id
FROM sanciones_partidos_cumplidos c
JOIN sanciones_partidos_excluidos e
  ON e.sancion_id = c.sancion_id AND e.partido_id = c.partido_id
ORDER BY c.sancion_id, c.partido_id;

-- AUDIT: SA04|error|Sancion activa por partidos cuyo contador ya alcanzo el total
SELECT id, jugador_id, campeonato_id, partidos_suspension,
       partidos_cumplidos, suspension_activa
FROM sanciones
WHERE activo = TRUE
  AND suspension_activa = TRUE
  AND partidos_suspension > 0
  AND partidos_cumplidos >= partidos_suspension
ORDER BY id;

-- AUDIT: SA05|error|Partido contado como sancion aunque el jugador figura que participo
SELECT spc.sancion_id, spc.partido_id, s.jugador_id, aa.estado AS estado_planilla
FROM sanciones_partidos_cumplidos spc
JOIN sanciones s ON s.id = spc.sancion_id
JOIN acta_alineacion aa
  ON aa.partido_id = spc.partido_id
 AND aa.jugador_id = s.jugador_id
 AND aa.activo = TRUE
WHERE aa.estado IN ('jugo', 'expulsado')
ORDER BY spc.sancion_id, spc.partido_id;

-- AUDIT: PR01|error|Partido incluido en mas de una programacion abierta
SELECT pb.partido_id, COUNT(DISTINCT pb.programacion_id) AS programaciones,
       ARRAY_AGG(DISTINCT pb.programacion_id ORDER BY pb.programacion_id) AS registros
FROM programacion_bolillas pb
JOIN programaciones_semanales ps ON ps.id = pb.programacion_id
WHERE ps.estado IN ('borrador', 'en_sorteo') AND pb.partido_id IS NOT NULL
GROUP BY pb.partido_id
HAVING COUNT(DISTINCT pb.programacion_id) > 1
ORDER BY pb.partido_id;

-- AUDIT: PR02|error|Estado de bolilla incompatible con su partido asignado
SELECT id, programacion_id, partido_id, estado, numero
FROM programacion_bolillas
WHERE (estado = 'asignada' AND partido_id IS NULL)
   OR (estado = 'disponible' AND partido_id IS NOT NULL)
   OR (estado = 'no_utilizada' AND partido_id IS NOT NULL)
ORDER BY programacion_id, numero;

-- AUDIT: PR03|error|Horario confirmado que no coincide entre bolilla y partido
SELECT pb.id AS bolilla_id, pb.programacion_id, pb.partido_id,
       pb.fecha AS fecha_bolilla, p.fecha_partido,
       pb.hora AS hora_bolilla, p.hora_partido,
       pb.cancha AS cancha_bolilla, p.cancha AS cancha_partido
FROM programacion_bolillas pb
JOIN programaciones_semanales ps ON ps.id = pb.programacion_id
JOIN partidos p ON p.id = pb.partido_id
WHERE ps.estado = 'confirmada'
  AND pb.estado = 'asignada'
  AND (p.fecha_partido IS DISTINCT FROM pb.fecha
    OR p.hora_partido IS DISTINCT FROM pb.hora
    OR p.cancha IS DISTINCT FROM pb.cancha)
ORDER BY pb.programacion_id, pb.numero;

-- AUDIT: PR04|error|Seleccion de categoria y jornada repetida dentro de una programacion
SELECT programacion_id, categoria_id, jornada, COUNT(*) AS cantidad,
       ARRAY_AGG(id ORDER BY id) AS registros
FROM programacion_selecciones
GROUP BY programacion_id, categoria_id, jornada
HAVING COUNT(*) > 1
ORDER BY programacion_id, categoria_id, jornada;

-- AUDIT: VO01|error|Vocalia asignada o confirmada sin responsable valido
SELECT id, programacion_id, partido_id, tipo_asignacion, estado,
       equipo_vocal_id, directivo_nombre
FROM vocalias_partido
WHERE estado IN ('asignada', 'confirmada')
  AND ((tipo_asignacion = 'directivo' AND NULLIF(TRIM(directivo_nombre), '') IS NULL)
    OR (tipo_asignacion <> 'directivo' AND equipo_vocal_id IS NULL))
ORDER BY programacion_id, partido_id;

-- AUDIT: VO02|error|Vocalia liberada que conserva datos del sorteo anterior
SELECT id, programacion_id, partido_id, estado, equipo_extractor_id,
       resultado_bolilla, equipo_vocal_id, directivo_nombre
FROM vocalias_partido
WHERE estado = 'pendiente'
  AND (equipo_extractor_id IS NOT NULL OR resultado_bolilla IS NOT NULL
    OR equipo_vocal_id IS NOT NULL OR directivo_nombre IS NOT NULL)
ORDER BY programacion_id, partido_id;

-- AUDIT: VO03|error|Resultado Si-No que no corresponde al extractor y vocal registrados
SELECT v.id, v.programacion_id, v.partido_id, v.partido_origen_id,
       v.equipo_extractor_id, v.resultado_bolilla, v.equipo_vocal_id,
       origen.equipo_local_id, origen.equipo_visitante_id
FROM vocalias_partido v
JOIN partidos origen ON origen.id = v.partido_origen_id
WHERE v.tipo_asignacion = 'sorteo'
  AND v.estado IN ('asignada', 'confirmada')
  AND (
    v.equipo_extractor_id IS NULL
    OR v.resultado_bolilla NOT IN ('si', 'no')
    OR v.equipo_extractor_id NOT IN (origen.equipo_local_id, origen.equipo_visitante_id)
    OR (v.resultado_bolilla = 'si' AND v.equipo_vocal_id IS DISTINCT FROM v.equipo_extractor_id)
    OR (v.resultado_bolilla = 'no' AND v.equipo_vocal_id IS DISTINCT FROM
      CASE WHEN v.equipo_extractor_id = origen.equipo_local_id
           THEN origen.equipo_visitante_id ELSE origen.equipo_local_id END)
  )
ORDER BY v.programacion_id, v.partido_id;

-- AUDIT: VO04|error|Equipo vocal programado para jugar a la misma fecha y hora
SELECT v.id AS vocalia_id, v.partido_id AS partido_vocalizado,
       v.equipo_vocal_id, p.fecha_partido, p.hora_partido,
       conflicto.id AS partido_conflicto
FROM vocalias_partido v
JOIN partidos p ON p.id = v.partido_id
JOIN partidos conflicto
  ON conflicto.id <> p.id
 AND conflicto.activo = TRUE
 AND conflicto.fecha_partido = p.fecha_partido
 AND conflicto.hora_partido = p.hora_partido
 AND v.equipo_vocal_id IN (conflicto.equipo_local_id, conflicto.equipo_visitante_id)
WHERE v.estado IN ('asignada', 'confirmada')
  AND v.equipo_vocal_id IS NOT NULL
ORDER BY v.programacion_id, v.partido_id;

-- AUDIT: VO05|error|Programacion confirmada con partido asignado sin vocalia confirmada
SELECT ps.id AS programacion_id, pb.partido_id, pb.numero AS bolilla,
       ps.confirmado_en, v.id AS vocalia_id, v.estado AS estado_vocalia
FROM programaciones_semanales ps
JOIN programacion_bolillas pb
  ON pb.programacion_id = ps.id AND pb.estado = 'asignada' AND pb.partido_id IS NOT NULL
LEFT JOIN vocalias_partido v
  ON v.programacion_id = ps.id AND v.partido_id = pb.partido_id
WHERE ps.estado = 'confirmada'
  AND ps.confirmado_en >= (SELECT MIN(creado_en) FROM vocalias_partido)
  AND (v.id IS NULL OR v.estado <> 'confirmada')
ORDER BY ps.id, pb.numero;

-- AUDIT: VO06|advertencia|Programacion historica confirmada antes de existir el sorteo de vocalias
SELECT ps.id AS programacion_id, ps.confirmado_en,
       COUNT(pb.id) AS partidos_sin_vocalia
FROM programaciones_semanales ps
JOIN programacion_bolillas pb
  ON pb.programacion_id = ps.id AND pb.estado = 'asignada' AND pb.partido_id IS NOT NULL
LEFT JOIN vocalias_partido v
  ON v.programacion_id = ps.id AND v.partido_id = pb.partido_id
WHERE ps.estado = 'confirmada'
  AND (ps.confirmado_en < (SELECT MIN(creado_en) FROM vocalias_partido)
    OR (SELECT MIN(creado_en) FROM vocalias_partido) IS NULL)
  AND v.id IS NULL
GROUP BY ps.id, ps.confirmado_en
ORDER BY ps.id;

-- AUDIT: PA01|error|Partido activo con el mismo equipo como local y visitante
SELECT id, campeonato_id, categoria_id, etapa, jornada, equipo_local_id
FROM partidos
WHERE activo = TRUE AND equipo_local_id = equipo_visitante_id
ORDER BY id;

-- AUDIT: PA02|error|Partido jugado sin marcador completo
SELECT id, campeonato_id, categoria_id, etapa, jornada,
       goles_local, goles_visitante
FROM partidos
WHERE activo = TRUE AND estado = 'jugado'
  AND (goles_local IS NULL OR goles_visitante IS NULL)
ORDER BY id;

-- AUDIT: PA03|advertencia|Partido jugado sin informe de acta activo
SELECT p.id, p.campeonato_id, p.categoria_id, p.etapa, p.jornada,
       p.fecha_partido
FROM partidos p
WHERE p.activo = TRUE AND p.estado = 'jugado'
  AND NOT EXISTS (
    SELECT 1 FROM acta_informe_partido ai
    WHERE ai.partido_id = p.id AND ai.activo = TRUE
  )
ORDER BY p.id;

-- AUDIT: PA04|error|Alineacion registrada para un equipo que no participa en el partido
SELECT aa.id, aa.partido_id, aa.jugador_id, aa.equipo_id,
       p.equipo_local_id, p.equipo_visitante_id
FROM acta_alineacion aa
JOIN partidos p ON p.id = aa.partido_id
WHERE aa.activo = TRUE
  AND aa.equipo_id NOT IN (p.equipo_local_id, p.equipo_visitante_id)
ORDER BY aa.partido_id, aa.id;

-- AUDIT: PA05|error|Mas de una alineacion activa del mismo jugador en un partido
SELECT partido_id, jugador_id, COUNT(*) AS cantidad,
       ARRAY_AGG(id ORDER BY id) AS registros
FROM acta_alineacion
WHERE activo = TRUE
GROUP BY partido_id, jugador_id
HAVING COUNT(*) > 1
ORDER BY partido_id, jugador_id;

-- AUDIT: PA06|error|Gol con campeonato categoria o equipo incompatible con el partido
SELECT g.id AS gol_id, g.partido_id, g.jugador_id,
       g.campeonato_id AS campeonato_gol, p.campeonato_id AS campeonato_partido,
       g.categoria_id AS categoria_gol, p.categoria_id AS categoria_partido,
       g.equipo_id
FROM goles g
JOIN partidos p ON p.id = g.partido_id
WHERE g.activo = TRUE
  AND (g.campeonato_id <> p.campeonato_id
    OR g.categoria_id <> p.categoria_id
    OR g.equipo_id NOT IN (p.equipo_local_id, p.equipo_visitante_id))
ORDER BY g.partido_id, g.id;

-- AUDIT: PA07|advertencia|Gol activo de jugador que no consta en la alineacion activa del partido
SELECT g.id AS gol_id, g.partido_id, g.jugador_id, g.equipo_id
FROM goles g
WHERE g.activo = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM acta_alineacion aa
    WHERE aa.partido_id = g.partido_id
      AND aa.jugador_id = g.jugador_id
      AND aa.activo = TRUE
      AND aa.estado IN ('jugo', 'expulsado')
  )
ORDER BY g.partido_id, g.id;

-- AUDIT: PA08|error|Partido vinculado con una categoria de otro campeonato
SELECT p.id, p.campeonato_id, p.categoria_id,
       c.campeonato_id AS campeonato_categoria, p.etapa, p.jornada
FROM partidos p
JOIN categorias c ON c.id = p.categoria_id
WHERE p.campeonato_id <> c.campeonato_id
ORDER BY p.id;
