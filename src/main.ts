import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as http from 'http';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ── CORS ─────────────────────────────────────────────────────────────────
  // IMPORTANTE: enableCors debe ir ANTES de cualquier middleware/pipes/prefix.
  //
  // CORS_ORIGIN = lista separada por comas, ej:
  //   "https://ligasbarrialesec.of1solutions.com,http://localhost:4200"
  //
  // Sin CORS_ORIGIN en producción → fail-safe (rechaza todo).
  // En desarrollo (NODE_ENV != production) se permiten los orígenes locales.
  const isProduction = process.env.NODE_ENV === 'production';

  const allowedOrigins: string[] = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : isProduction
      ? [] // sin env var en prod → se bloquea todo (forzar configuración explícita)
      : ['http://localhost:4200', 'http://localhost:3001'];

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    // Responde 204 al preflight OPTIONS en lugar de 200 (algunos proxies lo requieren)
    optionsSuccessStatus: 204,
    preflightContinue: false,
  });

  // ── Archivos estáticos ────────────────────────────────────────────────────
  app.useStaticAssets(join(process.cwd(), 'src', 'public'), {
    prefix: '/',
  });

  // ── Validación global de DTOs ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Prefijo global /api ───────────────────────────────────────────────────
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  // ── Servidor HTTP ─────────────────────────────────────────────────────────
  const port = parseInt(process.env.PORT ?? '3000', 10);

  // Escuchar en 0.0.0.0 (requerido en Render/Docker para aceptar tráfico externo)
  await app.listen(port, '0.0.0.0');

  // Fix 502 intermitente en Render:
  // Node.js cierra conexiones keep-alive a los 5s (por defecto).
  // El load balancer de Render intenta reutilizarlas hasta ~75s → 502.
  // Solución: keepAliveTimeout > 75s. headersTimeout siempre debe ser > keepAliveTimeout.
  const httpServer = app.getHttpServer() as http.Server;
  httpServer.keepAliveTimeout = 90_000; // 90 segundos
  httpServer.headersTimeout   = 91_000; // siempre mayor que keepAliveTimeout

  console.log(`🚀 Backend corriendo en http://0.0.0.0:${port}/api`);
  console.log(`🌐 Orígenes CORS permitidos: ${allowedOrigins.join(', ') || '(ninguno — definir CORS_ORIGIN)'}`);
}

bootstrap();
