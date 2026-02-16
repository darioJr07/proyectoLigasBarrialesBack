# Backend - Sistema de Ligas Barriales

Backend API REST construido con NestJS, TypeScript y PostgreSQL.

## Tecnologías

- **NestJS** - Framework backend robusto
- **TypeScript** - Tipado estático
- **PostgreSQL** - Base de datos
- **TypeORM** - ORM para gestión de base de datos
- **JWT** - Autenticación con tokens
- **Bcrypt** - Hash de contraseñas
- **Class Validator** - Validación de DTOs

## Arquitectura

El proyecto sigue principios SOLID y clean code:

- **Single Responsibility**: Cada clase tiene una única responsabilidad
- **Dependency Inversion**: Las dependencias se inyectan mediante constructores
- **Modular**: Código organizado en módulos independientes
- **Validación**: Validación automática de DTOs con class-validator

## Estructura del proyecto

```
backend/
├── src/
│   ├── config/              # Configuraciones (DB, etc.)
│   ├── modules/             # Módulos de la aplicación
│   │   └── auth/           # Módulo de autenticación
│   │       ├── dto/        # Data Transfer Objects
│   │       ├── entities/   # Entidades TypeORM
│   │       ├── guards/     # Guards de autenticación
│   │       ├── strategies/ # Estrategias Passport
│   │       ├── auth.controller.ts
│   │       ├── auth.service.ts
│   │       └── auth.module.ts
│   ├── app.module.ts        # Módulo raíz
│   └── main.ts             # Punto de entrada
├── .env.example            # Variables de entorno de ejemplo
├── package.json
└── tsconfig.json
```

## Instalación

### Requisitos previos
- Node.js (v18 o superior)
- PostgreSQL (v14 o superior)
- npm o yarn

### Pasos

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar el archivo `.env` con tus datos:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_DATABASE=ligas_barriales
DB_SYNCHRONIZE=true
JWT_SECRET=tu_secret_key_cambiar_en_produccion
```

**⚡ Inicialización automática:**
- Al arrancar por primera vez, el backend automáticamente:
  - ✅ Crea todas las tablas basadas en las entities de TypeORM (15 tablas en total)
  - ✅ Crea los 3 roles básicos (master, directivo_liga, dirigente_equipo)
  - ✅ Crea el usuario administrador con credenciales por defecto
- Si las tablas ya existen, las respeta y no sobrescribe datos

**🔐 Usuario admin creado automáticamente:**
- Email: `admin@ligasbarriales.com`
- Contraseña: `password123`
- ⚠️ **IMPORTANTE:** Cambiar la contraseña después del primer inicio de sesión

3. Asegurarse de que PostgreSQL esté corriendo:
- La base de datos se creará automáticamente si no existe
- No es necesario ejecutar scripts SQL manualmente

4. Iniciar el servidor en modo desarrollo:
```bash
npm run start:dev
```

El servidor estará disponible en `http://localhost:3000/api`

## Endpoints disponibles

### Autenticación

#### Registro de usuario
```http
POST /api/auth/register
Content-Type: application/json

{
  "nombre": "Juan Pérez",
  "email": "juan@example.com",
  "password": "123456",
  "rolId": 1
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@ligasbarriales.com",
  "password": "password123"
}
```

**Usuario inicial (creado automáticamente al arrancar):**
- Email: `admin@ligasbarriales.com`
- Contraseña: `password123`
- ⚠️ **IMPORTANTE:** Cambiar la contraseña después del primer inicio de sesión por seguridad

Respuesta:
```json
{
  "user": {
    "id": 1,
    "nombre": "Administrador Sistema",
    "email": "admin@ligasbarriales.com",
    "rol": {
      "id": 1,
      "nombre": "master"
    },
    "activo": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Perfil de usuario (requiere autenticación)
```http
GET /api/auth/profile
Authorization: Bearer {token}
```

### Gestión de Usuarios

#### Listar todos los usuarios
```http
GET /api/usuarios
Authorization: Bearer {token}
```

#### Obtener un usuario por ID
```http
GET /api/usuarios/:id
Authorization: Bearer {token}
```

#### Crear nuevo usuario
```http
POST /api/usuarios
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "María García",
  "email": "maria@example.com",
  "password": "123456",
  "rolId": 2
}
```

#### Actualizar usuario
```http
PATCH /api/usuarios/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombre": "María García López",
  "rolId": 3
}
```

#### Cambiar contraseña
```http
PATCH /api/usuarios/:id/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "newPassword": "nuevaPassword123"
}
```

#### Activar usuario
```http
PATCH /api/usuarios/:id/activate
Authorization: Bearer {token}
```

#### Desactivar usuario
```http
PATCH /api/usuarios/:id/deactivate
Authorization: Bearer {token}
```

#### Eliminar usuario (desactivación lógica)
```http
DELETE /api/usuarios/:id
Authorization: Bearer {token}
```

## Scripts disponibles

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod

# Tests
npm run test
npm run test:watch
npm run test:cov

# Linting
npm run lint
npm run format
```

## Próximos pasos

1. Crear módulos para ligas, equipos, jugadores, etc.
2. Implementar guards de roles para permisos
3. Agregar documentación con Swagger
4. Implementar tests unitarios e integración
