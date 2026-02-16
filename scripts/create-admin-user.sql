-- Script para crear usuario inicial con contraseña conocida
-- Ejecutar este script después de crear las tablas

-- Insertar usuario master con contraseña "password123"
-- Hash generado con bcrypt: $2b$10$Ezl4t.zCqJY3O8a8rQ4QoO5fDJrWHZ7Yb8Pq1Qv2D7K0kFJ4XfTqS

-- Primero verificar que existe el rol master (ID = 1)
-- Si no existe, crearlo primero con:
-- INSERT INTO roles (nombre, descripcion) VALUES ('master', 'Administrador del sistema con acceso total');

-- Crear usuario master
INSERT INTO usuarios (nombre, email, password, rol_id, activo) 
VALUES (
  'Administrador Sistema', 
  'admin@ligasbarriales.com', 
  '$2b$10$Ezl4t.zCqJY3O8a8rQ4QoO5fDJrWHZ7Yb8Pq1Qv2D7K0kFJ4XfTqS', 
  1, 
  true
)
ON CONFLICT (email) DO UPDATE
SET password = '$2b$10$Ezl4t.zCqJY3O8a8rQ4QoO5fDJrWHZ7Yb8Pq1Qv2D7K0kFJ4XfTqS',
    activo = true;

-- Credenciales de acceso:
-- Email: admin@ligasbarriales.com
-- Contraseña: password123

-- IMPORTANTE: Cambiar esta contraseña después del primer inicio de sesión
-- usando el módulo de gestión de usuarios en la aplicación web
