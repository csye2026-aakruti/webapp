// test/app.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import * as dotenv from 'dotenv';
import { AppModule } from '../src/app.module';

dotenv.config({ path: '.env.test' });

describe('WebApp E2E Tests', () => {
  let app: INestApplication;
  let server: any;
  let authHeader = '';

  const testUser = {
    username: `test_${Date.now()}@example.com`,
    password: 'SecretPassword123!',
    first_name: 'Test',
    last_name: 'User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------- HEALTHZ ----------------

  it('GET /healthz → 200', async () => {
    await supertest(server).get('/healthz').expect(200);
  });

  it('POST /healthz → 405', async () => {
    await supertest(server).post('/healthz').expect(405);
  });

  it('GET /healthz with payload → 400', async () => {
    await supertest(server).get('/healthz').send({ test: true }).expect(400);
  });

  // ---------------- USERS ----------------

  it('POST /v1/user → 201', async () => {
    const res = await supertest(server)
      .post('/v1/user')
      .send(testUser)
      .expect(201);

    // If your API returns user fields, verify basics (safe checks)
    expect(res.body).toBeDefined();
    expect(res.body.username || res.body.email).toBeTruthy();
  });

  it('POST /v1/user duplicate → 400', async () => {
    await supertest(server).post('/v1/user').send(testUser).expect(400);
  });

  // ---------------- AUTH + SELF ----------------

  it('GET /v1/user/self without auth → 401', async () => {
    await supertest(server).get('/v1/user/self').expect(401);
  });

  it('GET /v1/user/self with auth → 200', async () => {
    const basicAuth = Buffer.from(`${testUser.username}:${testUser.password}`).toString('base64');
    authHeader = `Basic ${basicAuth}`;

    const res = await supertest(server)
      .get('/v1/user/self')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.username).toBe(testUser.username);
    expect(res.body.password).toBeUndefined();
  });

  it('PUT /v1/user/self → 204', async () => {
    await supertest(server)
      .put('/v1/user/self')
      .set('Authorization', authHeader)
      .send({ first_name: 'Updated' })
      .expect(204);
  });

  it('PUT /v1/user/self invalid field → 400', async () => {
    await supertest(server)
      .put('/v1/user/self')
      .set('Authorization', authHeader)
      .send({ username: 'hack@example.com' })
      .expect(400);
  });
});