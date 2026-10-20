# Backend - Sistema de Ligas Barriales

API REST construida con NestJS, TypeScript, PostgreSQL y TypeORM.

**Estado de documentacion:** actualizado el 15/10/2026.
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
- `tesoreria`: cobros, movimientos, cuenta consolidada, libro de caja, configuración de vocalía, inicio operativo, conciliaciones y cierre definitivo por campeonato.
- `recibos-tesoreria`: emisión, consulta y reimpresión de recibos persistentes numerados por liga y año.
- `garantias`: garantias y prestamos del fondo.
- `derramas`: derramas colectivas y deudas.
- `configuracion`: configuraciones del sistema y guard autoritativo para cerrar Jugadores, Inscripciones/Habilitaciones y Transferencias a dirigentes.

## Cierre operativo de módulos

Las claves `modulo_jugadores`, `modulo_inscripciones` y `modulo_transferencias` se aplican en el backend mediante `ModuloHabilitadoGuard` y el decorador `@ModuloHabilitado(...)`.

- Solo restringen a `dirigente_equipo`; `master` y `directivo_liga` mantienen acceso administrativo.
- Se protegen las operaciones de escritura de jugadores, inscripciones/habilitaciones y transferencias que puede ejecutar un dirigente.
- El valor se consulta en la base de datos en cada operación protegida. Una sesión o formulario abierto antes del cierre no permite guardar después de deshabilitar el módulo.
- Un módulo cerrado responde HTTP `403`.
- No se requirió migración: se reutiliza la tabla `configuracion_sistema` y sus claves existentes.

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

## Despliegue vigente en Render

Configuración validada el 15/10/2026 para el repositorio independiente del backend y el plan gratuito de Render:

```text
Root Directory: (vacío)
Build Command: npm ci --include=dev && npm run build
Start Command: npm run start:prod
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=384
```

El build incluye las `devDependencies` porque `@nestjs/cli` y TypeScript son necesarios para generar `dist`. El arranque productivo no vuelve a compilar: ejecuta `node dist/main` mediante `npm run start:prod`.

Si se cambia la configuración, ejecutar **Manual Deploy → Clear build cache & deploy**. No configurar `Root Directory=backend` cuando Render está conectado directamente al repositorio `proyectoLigasBarrialesBack`, porque esa subcarpeta no existe dentro de dicho repositorio.

La combinación anterior corrigió los errores `JavaScript heap out of memory`, `nest: not found` y `Root directory "backend" does not exist` encontrados durante el despliegue.

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

Existe una primera cobertura automatizada para los flujos críticos de jugadores, habilitaciones, transferencias, usuarios y cierre operativo:

- `jugadores.service.spec.ts`: alcance de Master, directivo y dirigente.
- `jugador-campeonatos.service.spec.ts`: acceso por campeonato, reutilización de rechazos y revalidación de cupo.
- `transferencias.service.spec.ts`: bloqueo de solicitudes simultáneas, historial de rechazos y conclusión transaccional.
- `usuarios.service.spec.ts`: permisos de cambio de contraseña según usuario y rol.
- `modulo-habilitado.guard.spec.ts`: bypass administrativo y permiso/bloqueo del dirigente según la configuración vigente.
- Resultado del 15/10/2026: 5 suites y 22 pruebas aprobadas.
- Las pruebas usan mocks; no acceden a la base de datos y `tsconfig.build.json` excluye `**/*spec.ts` del build productivo.

Ejecución completa:

```bash
npm test -- --runInBand
```

La cobertura integral y E2E continúa como mejora futura.

## Auditoría de integridad

El archivo `audits/jugadores-habilitaciones-transferencias.sql` contiene únicamente consultas `SELECT` para detectar duplicidad de habilitaciones activas, dorsales repetidos, transferencias simultáneas e inconsistencias de equipo. La ejecución del 15/10/2026 no detectó novedades.

Se mantiene `DB_SYNCHRONIZE=true` por decisión operativa. No se agregó una migración de índices para estos flujos; esa protección queda aplazada hasta adoptar una estrategia formal de migraciones.

## Documentacion Relacionada

- [Estado actual del proyecto](../ESTADO_ACTUAL_PROYECTO.md)
- [Verificacion de tablas](../VERIFICACION_TABLAS_BD.md)
- [Inicializacion automatica](../INICIALIZACION_AUTOMATICA.md)
- [Modulo de Tesoreria](../MODULO_TESORERIA_RESUMEN.md)
- [Upload de imagenes](../UPLOAD_SYSTEM.md)
- [Cloudinary](../CONFIGURACION_CLOUDINARY.md)
