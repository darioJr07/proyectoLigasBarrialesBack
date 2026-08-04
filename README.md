# Backend - Sistema de Ligas Barriales

API REST construida con NestJS, TypeScript, PostgreSQL y TypeORM.

**Estado de documentacion:** actualizado el 30/07/2026.  
Para el estado funcional completo del sistema, revisar [../ESTADO_ACTUAL_PROYECTO.md](../ESTADO_ACTUAL_PROYECTO.md).

## Tecnologias

- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- JWT / Passport
- Bcrypt
- Class Validator
- Multer
- Cloudinary opcional para imagenes

## Modulos Backend Principales

- `auth`: login, registro, JWT, roles y guards.
- `usuarios`: administracion de usuarios.
- `ligas`: gestion de ligas.
- `equipos`: gestion de equipos.
- `jugadores`: gestion de jugadores.
- `upload`: subida de imagenes.
- `campeonatos`: torneos, estados y ascensos/descensos.
- `categorias`: categorias por campeonato.
- `inscripciones`: equipos inscritos.
- `jugador-campeonatos`: habilitaciones de jugadores.
- `transferencias`: doble aprobacion de transferencias.
- `partidos`: fixture, partidos y resultados.
- `goles`: registro de goles.
- `acta-partido`: acta, alineacion, informe e incidencias.
- `sanciones`: reglas, sanciones, apelaciones y arrastres.
- `tesoreria`: cobros, movimientos, libro de caja y configuracion vocalia.
- `garantias`: garantias y prestamos del fondo.
- `derramas`: derramas colectivas y deudas.
- `configuracion`: configuraciones del sistema.

## Instalacion

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```

API local:

```text
http://localhost:3000/api
```

## Variables de Entorno Relevantes

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres123
DB_DATABASE=ligas_barriales
DB_SYNCHRONIZE=true
JWT_SECRET=cambiar_en_produccion
USE_CLOUDINARY=false
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
TZ=America/Guayaquil
```

En produccion se recomienda:

- Cambiar `JWT_SECRET`.
- Usar `USE_CLOUDINARY=true` si el servidor no conserva archivos locales.
- Revisar cuidadosamente `DB_SYNCHRONIZE`.

## Inicializacion Automatica

El backend puede crear datos base al arrancar:

- roles principales,
- usuario administrador,
- tablas gestionadas por TypeORM si `DB_SYNCHRONIZE=true`.

Usuario por defecto, si no existe:

```text
admin@ligasbarriales.com / password123
```

Cambiar la clave despues del primer inicio de sesion.

## Scripts

```bash
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run format
npm test
npm run test:e2e
npm run test:cov
```

## Testing

Los comandos de test existen, pero la documentacion vigente marca como pendiente una estrategia completa de tests automatizados unitarios, integracion y E2E.

## Documentacion Relacionada

- [Estado actual del proyecto](../ESTADO_ACTUAL_PROYECTO.md)
- [Verificacion de tablas](../VERIFICACION_TABLAS_BD.md)
- [Inicializacion automatica](../INICIALIZACION_AUTOMATICA.md)
- [Modulo de Tesoreria](../MODULO_TESORERIA_RESUMEN.md)
- [Upload de imagenes](../UPLOAD_SYSTEM.md)
- [Cloudinary](../CONFIGURACION_CLOUDINARY.md)

