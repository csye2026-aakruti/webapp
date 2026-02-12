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

  it('GET /healthz → 400', async () => {
    const res = await supertest(server).get('/healthz').expect(400);
    expect(res.text ?? '').toBe('');
    expect(String(res.headers['cache-control']).toLowerCase()).toContain('no-cache');
  });

  it('POST /healthz → 405', async () => {
    const res = await supertest(server).post('/healthz').expect(405);
    expect(res.text ?? '').toBe('');
  });

  it('GET /healthz with payload → 400', async () => {
    const res = await supertest(server).get('/healthz').send({ test: true }).expect(400);
    expect(res.text ?? '').toBe('');
  });

  it('PUT /healthz → 405', async () => {
    const res = await supertest(server).put('/healthz').expect(405);
    expect(res.text ?? '').toBe('');
  });
  
  it('PATCH /healthz → 405', async () => {
    const res = await supertest(server).patch('/healthz').expect(405);
    expect(res.text ?? '').toBe('');
  });
  
  it('DELETE /healthz → 405', async () => {
    const res = await supertest(server).delete('/healthz').expect(405);
    expect(res.text ?? '').toBe('');
  });

  it('POST /v1/user → 201', async () => {
    const res = await supertest(server)
      .post('/v1/user')
      .send(testUser)
      .expect(201);

    expect(res.body).toBeDefined();
    expect(res.body.username || res.body.email).toBeTruthy();
    expect(res.body.password).toBeUndefined();
  });

  it('POST /v1/user duplicate → 400', async () => {
    await supertest(server).post('/v1/user').send(testUser).expect(400);
  });

  it('POST /v1/user invalid email → 400', async () => {
    await supertest(server)
      .post('/v1/user')
      .send({ ...testUser, username: 'not-an-email' })
      .expect(400);
  });

  it('POST /v1/user missing field → 400', async () => {
    await supertest(server)
      .post('/v1/user')
      .send({
        username: `missing_${Date.now()}@example.com`,
        password: 'SecretPassword123!',
        first_name: 'Test',
      })
      .expect(400);
  });

  it('POST /v1/user ignores timestamps → 201', async () => {
    const fake = '2000-01-01T00:00:00.000Z';

    const res = await supertest(server)
      .post('/v1/user')
      .send({
        username: `ts_${Date.now()}@example.com`,
        password: 'SecretPassword123!',
        first_name: 'TS',
        last_name: 'Ignore',
        account_created: fake,
        account_updated: fake,
      })
      .expect(201);

    if (res.body.account_created) expect(res.body.account_created).not.toBe(fake);
    if (res.body.account_updated) expect(res.body.account_updated).not.toBe(fake);
    expect(res.body.password).toBeUndefined();
  });

  it('GET /v1/user/self without auth → 401', async () => {
    await supertest(server).get('/v1/user/self').expect(401);
  });

  it('GET /v1/user/self wrong password → 401', async () => {
    const bad = Buffer.from(`${testUser.username}:WRONG`).toString('base64');
    await supertest(server)
      .get('/v1/user/self')
      .set('Authorization', `Basic ${bad}`)
      .expect(401);
  });

  it('GET /v1/user/self with auth → 200', async () => {
    authHeader = `Basic ${Buffer.from(
      `${testUser.username}:${testUser.password}`,
    ).toString('base64')}`;

    const res = await supertest(server)
      .get('/v1/user/self')
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.username).toBe(testUser.username);
    expect(res.body.password).toBeUndefined();
  });

  it('PUT /v1/user/self without auth → 401', async () => {
    await supertest(server)
      .put('/v1/user/self')
      .send({ first_name: 'NoAuth' })
      .expect(401);
  });

  it('PUT /v1/user/self → 204', async () => {
    const before = await supertest(server)
      .get('/v1/user/self')
      .set('Authorization', authHeader)
      .expect(200);

    await supertest(server)
      .put('/v1/user/self')
      .set('Authorization', authHeader)
      .send({ first_name: 'Updated' })
      .expect(204);

    const after = await supertest(server)
      .get('/v1/user/self')
      .set('Authorization', authHeader)
      .expect(200);

    if (before.body.account_updated && after.body.account_updated) {
      expect(new Date(after.body.account_updated).getTime()).toBeGreaterThan(
        new Date(before.body.account_updated).getTime(),
      );
    }
  });

  it('PUT /v1/user/self invalid field → 400', async () => {
    await supertest(server)
      .put('/v1/user/self')
      .set('Authorization', authHeader)
      .send({ username: 'hack@example.com' })
      .expect(400);
  });
});
console.log(process.env.DB_NAME);