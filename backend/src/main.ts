import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import * as express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // ── Security headers (Helmet) ──────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));

  // ── Body parser with size limit ────────────────────────────────────────────
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // ── Ensure uploads directory exists ───────────────────────────────────────
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // NOTE: /uploads is served publicly (no auth). In production, move file
  // storage to a private bucket (S3/Cloudinary) and remove this line.
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  // ── Global validation pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:4200',
    'http://127.0.0.1:4200',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // In production, reject unknown origins. In development, allow all.
      if (isProduction) {
        return callback(new Error(`CORS: origin '${origin}' not allowed`), false);
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Global prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Swagger / OpenAPI (solo en desarrollo) ────────────────────────────────
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Gastos API')
      .setDescription('API REST para la plataforma de gestión de gastos personales')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Autenticación y registro')
      .addTag('users', 'Gestión de usuarios')
      .addTag('expenses', 'Gestión de gastos')
      .addTag('tickets', 'Carga y procesamiento de tickets')
      .addTag('recommendations', 'Recomendaciones financieras')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
    console.log(`📚 Swagger docs en:      http://localhost:${process.env.PORT || 3000}/docs`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Servidor corriendo en: http://localhost:${port}/api`);
}

bootstrap();
