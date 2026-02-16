-- Arreglar la transferencia completada del jugador CI 1714734793

-- 1. Ver estado actual
SELECT 
    j.id,
    j.cedula,
    j.nombre,
    j.equipo_id as equipo_actual_id,
    e_actual.nombre as equipo_actual,
    t.equipo_destino_id as equipo_deberia_ser_id,
    e_destino.nombre as equipo_deberia_ser
FROM jugadores j
JOIN transferencias t ON t.jugador_id = j.id
LEFT JOIN equipos e_actual ON e_actual.id = j.equipo_id
LEFT JOIN equipos e_destino ON e_destino.id = t.equipo_destino_id
WHERE j.cedula = '1714734793'
    AND t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
    AND t.activo = true
ORDER BY t.fecha_solicitud DESC
LIMIT 1;

-- 2. Actualizar el equipo del jugador al equipo destino de la transferencia
UPDATE jugadores j
JOIN transferencias t ON t.jugador_id = j.id
SET j.equipo_id = t.equipo_destino_id
WHERE j.cedula = '1714734793'
    AND t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
    AND t.activo = true
    AND j.equipo_id != t.equipo_destino_id;

-- 3. Verificar que se aplicó correctamente
SELECT 
    j.id,
    j.cedula,
    j.nombre,
    j.equipo_id,
    e.nombre as equipo_actual,
    CASE 
        WHEN j.equipo_id = t.equipo_destino_id THEN '✓ CORRECTO - Jugador en equipo destino'
        ELSE '✗ ERROR - Jugador aún en equipo origen'
    END as estado
FROM jugadores j
JOIN transferencias t ON t.jugador_id = j.id
LEFT JOIN equipos e ON e.id = j.equipo_id
WHERE j.cedula = '1714734793'
    AND t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
    AND t.activo = true
ORDER BY t.fecha_solicitud DESC
LIMIT 1;
