import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Smoke test e2e del flujo de autenticación completo: registro, login,
 * y protección de rutas por JWT/rol. Levanta la app real (AppModule) con
 * la misma configuración que main.ts (ValidationPipe + prefijo /api),
 * y pega contra la base de datos configurada en DATABASE_URL.
 *
 * No hay DB de test separada en este proyecto, así que el usuario de
 * prueba se crea con un email único por corrida y se borra en afterAll
 * para no dejar basura en la base compartida con la demo.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testEmail = `e2e-${Date.now()}@gastosapp-test.local`;
  const testPassword = 'TestPass123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it('POST /api/auth/register crea un usuario y devuelve un JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'E2E Test User', email: testEmail, password: testPassword })
      .expect(201);

    expect(res.body.access_token).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.role).toBe('USER');
    expect(res.body.user.password).toBeUndefined(); // nunca debe filtrar el hash
  });

  it('POST /api/auth/register con email duplicado devuelve 409', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Duplicado', email: testEmail, password: testPassword })
      .expect(409);
  });

  it('POST /api/auth/login con credenciales correctas devuelve un JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    expect(res.body.access_token).toBeDefined();
  });

  it('POST /api/auth/login con contraseña incorrecta devuelve 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'ContraseñaIncorrecta' })
      .expect(401);
  });

  it('POST /api/auth/login con email inexistente devuelve 401 (no 404 — evita user enumeration)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'no-existe@gastosapp-test.local', password: testPassword })
      .expect(401);
  });

  it('GET /api/expenses sin token devuelve 401', async () => {
    await request(app.getHttpServer()).get('/api/expenses').expect(401);
  });

  it('GET /api/users con un usuario sin rol ADVISOR devuelve 403', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`)
      .expect(403);
  });
});
