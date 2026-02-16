-- Script de diagnóstico para jugador CI 1714734793

-- 1. Ver datos del jugador en la tabla jugadores
SELECT 
    j.id,
    j.cedula,
    j.nombre,
    j.equipo_id,
    e.nombre as nombre_equipo
FROM jugadores j
LEFT JOIN equipos e ON e.id = j.equipo_id
WHERE j.cedula = '1714734793';

-- 2. Ver transferencias de este jugador
SELECT 
    t.id,
    t.jugador_id,
    t.campeonato_id,
    eo.nombre as equipo_origen,
    ed.nombre as equipo_destino,
    t.estado_equipo_origen,
    t.estado_directivo,
    t.fecha_solicitud,
    t.activo
FROM transferencias t
JOIN equipos eo ON eo.id = t.equipo_origen_id
JOIN equipos ed ON ed.id = t.equipo_destino_id
JOIN jugadores j ON j.id = t.jugador_id
WHERE j.cedula = '1714734793'
ORDER BY t.fecha_solicitud DESC;

-- 3. Ver si el jugador tiene habilitación en el campeonato
SELECT 
    jc.id,
    jc.jugador_id,
    jc.campeonato_id,
    c.nombre as campeonato,
    jc.habilitado,
    jc.activo
FROM jugador_campeonatos jc
JOIN jugadores j ON j.id = jc.jugador_id
JOIN campeonatos c ON c.id = jc.campeonato_id
WHERE j.cedula = '1714734793';

-- 4. Verificar equipo_id del jugador vs equipo destino de la transferencia
SELECT 
    j.nombre as jugador,
    j.equipo_id as equipo_actual_id,
    e_actual.nombre as equipo_actual,
    t.equipo_destino_id as equipo_deberia_ser_id,
    e_destino.nombre as equipo_deberia_ser,
    CASE 
        WHEN j.equipo_id = t.equipo_destino_id THEN '✓ CORRECTO'
        ELSE '✗ ERROR - No se movió el jugador'
    END as estado_transferencia
FROM jugadores j
JOIN transferencias t ON t.jugador_id = j.id
JOIN equipos e_actual ON e_actual.id = j.equipo_id
JOIN equipos e_destino ON e_destino.id = t.equipo_destino_id
WHERE j.cedula = '1714734793'
    AND t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
    AND t.activo = true
ORDER BY t.fecha_solicitud DESC
LIMIT 1;
