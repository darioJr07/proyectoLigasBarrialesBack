-- Script para corregir categorías de jugadores transferidos
-- Cuando un jugador se transfiere, debe tomar la categoría del equipo destino

-- 1. Ver transferencias completadas con categorías incorrectas
SELECT 
    t.id as transferencia_id,
    j.nombre as jugador,
    eo.nombre as equipo_origen,
    ed.nombre as equipo_destino,
    cat_actual.nombre as categoria_actual_jugador,
    cat_destino.nombre as categoria_equipo_destino,
    jc.categoria_id as categoria_id_actual,
    i_destino.categoria_id as categoria_id_correcta
FROM transferencias t
JOIN jugadores j ON j.id = t.jugador_id
JOIN equipos eo ON eo.id = t.equipo_origen_id
JOIN equipos ed ON ed.id = t.equipo_destino_id
JOIN jugador_campeonatos jc ON jc.jugador_id = t.jugador_id 
    AND jc.campeonato_id = t.campeonato_id 
    AND jc.activo = true
JOIN inscripciones i_destino ON i_destino.campeonato_id = t.campeonato_id 
    AND i_destino.equipo_id = t.equipo_destino_id
    AND i_destino.activo = true
    AND i_destino.estado = 'confirmada'
LEFT JOIN categorias cat_actual ON cat_actual.id = jc.categoria_id
LEFT JOIN categorias cat_destino ON cat_destino.id = i_destino.categoria_id
WHERE t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
    AND t.activo = true
    AND jc.categoria_id != i_destino.categoria_id;

-- 2. Corregir las categorías de los jugadores transferidos
UPDATE jugador_campeonatos jc
SET categoria_id = (
    SELECT i.categoria_id
    FROM inscripciones i
    JOIN transferencias t ON t.campeonato_id = i.campeonato_id 
        AND t.equipo_destino_id = i.equipo_id
    WHERE t.jugador_id = jc.jugador_id
        AND t.campeonato_id = jc.campeonato_id
        AND i.activo = true
        AND i.estado = 'confirmada'
        AND t.estado_equipo_origen = 'aprobado'
        AND t.estado_directivo = 'aprobado'
        AND t.activo = true
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM transferencias t
    JOIN inscripciones i ON i.campeonato_id = t.campeonato_id 
        AND i.equipo_id = t.equipo_destino_id
    WHERE t.jugador_id = jc.jugador_id
        AND t.campeonato_id = jc.campeonato_id
        AND t.estado_equipo_origen = 'aprobado'
        AND t.estado_directivo = 'aprobado'
        AND t.activo = true
        AND i.activo = true
        AND i.estado = 'confirmada'
        AND jc.categoria_id != i.categoria_id
);

-- 3. Verificar que se aplicó correctamente
SELECT 
    t.id as transferencia_id,
    j.nombre as jugador,
    ed.nombre as equipo_destino,
    cat_actual.nombre as categoria_jugador,
    cat_destino.nombre as categoria_equipo,
    CASE 
        WHEN jc.categoria_id = i_destino.categoria_id THEN '✓ OK'
        ELSE '✗ ERROR'
    END as estado
FROM transferencias t
JOIN jugadores j ON j.id = t.jugador_id
JOIN equipos ed ON ed.id = t.equipo_destino_id
JOIN jugador_campeonatos jc ON jc.jugador_id = t.jugador_id 
    AND jc.campeonato_id = t.campeonato_id 
    AND jc.activo = true
JOIN inscripciones i_destino ON i_destino.campeonato_id = t.campeonato_id 
    AND i_destino.equipo_id = t.equipo_destino_id
    AND i_destino.activo = true
    AND i_destino.estado = 'confirmada'
LEFT JOIN categorias cat_actual ON cat_actual.id = jc.categoria_id
LEFT JOIN categorias cat_destino ON cat_destino.id = i_destino.categoria_id
WHERE t.estado_equipo_origen = 'aprobado'
    AND t.estado_directivo = 'aprobado'
    AND t.activo = true;
