-- Script para corregir transferencias completadas que no movieron al jugador
-- Ejecutar este script manualmente en la base de datos

-- 1. Ver las transferencias completadas que necesitan corrección
SELECT 
    t.id as transferencia_id,
    t.jugador_id,
    j.nombre as jugador_nombre,
    t.equipo_origen_id,
    eo.nombre as equipo_origen,
    t.equipo_destino_id,
    ed.nombre as equipo_destino,
    j.equipo_id as jugador_equipo_actual,
    jc.equipo_id as habilitacion_equipo_actual
FROM transferencias t
JOIN jugadores j ON j.id = t.jugador_id
JOIN equipos eo ON eo.id = t.equipo_origen_id
JOIN equipos ed ON ed.id = t.equipo_destino_id
LEFT JOIN jugador_campeonatos jc ON jc.jugador_id = t.jugador_id 
    AND jc.campeonato_id = t.campeonato_id 
    AND jc.activo = true
WHERE t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
    AND t.activo = true
    AND (j.equipo_id != t.equipo_destino_id OR jc.equipo_id != t.equipo_destino_id);

-- 2. Aplicar la corrección para transferencias completadas
-- IMPORTANTE: Revisa los resultados del SELECT anterior antes de ejecutar esto

-- Actualizar jugador_campeonatos (habilitaciones)
UPDATE jugador_campeonatos jc
SET equipo_id = (
    SELECT t.equipo_destino_id 
    FROM transferencias t
    WHERE t.jugador_id = jc.jugador_id
        AND t.campeonato_id = jc.campeonato_id
        AND t.estado_equipo_origen = 'aprobado'
        AND t.estado_directivo = 'aprobado'
        AND t.activo = true
        AND jc.activo = true
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM transferencias t
    WHERE t.jugador_id = jc.jugador_id
        AND t.campeonato_id = jc.campeonato_id
        AND t.estado_equipo_origen = 'aprobado'
        AND t.estado_directivo = 'aprobado'
        AND t.activo = true
        AND jc.activo = true
        AND jc.equipo_id != t.equipo_destino_id
);

-- Actualizar jugadores (equipo base)
UPDATE jugadores j
SET equipo_id = (
    SELECT t.equipo_destino_id 
    FROM transferencias t
    WHERE t.jugador_id = j.id
        AND t.estado_equipo_origen = 'aprobado'
        AND t.estado_directivo = 'aprobado'
        AND t.activo = true
    ORDER BY t.fecha_aprobacion_directivo DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM transferencias t
    WHERE t.jugador_id = j.id
        AND t.estado_equipo_origen = 'aprobado'
        AND t.estado_directivo = 'aprobado'
        AND t.activo = true
        AND j.equipo_id != t.equipo_destino_id
);

-- 3. Verificar que se aplicó correctamente
SELECT 
    t.id as transferencia_id,
    j.nombre as jugador_nombre,
    eo.nombre as equipo_origen,
    ed.nombre as equipo_destino,
    j.equipo_id as jugador_equipo_actual,
    ed.id as equipo_esperado,
    CASE 
        WHEN j.equipo_id = ed.id THEN '✓ OK'
        ELSE '✗ ERROR'
    END as estado_jugador,
    jc.equipo_id as habilitacion_equipo,
    CASE 
        WHEN jc.equipo_id = ed.id THEN '✓ OK'
        ELSE '✗ ERROR'
    END as estado_habilitacion
FROM transferencias t
JOIN jugadores j ON j.id = t.jugador_id
JOIN equipos eo ON eo.id = t.equipo_origen_id
JOIN equipos ed ON ed.id = t.equipo_destino_id
LEFT JOIN jugador_campeonatos jc ON jc.jugador_id = t.jugador_id 
    AND jc.campeonato_id = t.campeonato_id 
    AND jc.activo = true
WHERE t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
    AND t.activo = true;
