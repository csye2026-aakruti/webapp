import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import * as dotenv from 'dotenv';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';

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
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
    }));
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /healthz → 200', async () => {
    const res = await supertest(server).get('/healthz').expect(200);
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

  // ------------------------------------------------------------------ //
  // GET /v1/metadata
  // ------------------------------------------------------------------ //

  it('GET /v1/metadata → 503 when not on cloud platform', async () => {
    const res = await supertest(server).get('/v1/metadata').expect(503);
    expect(res.body.error).toBeDefined();
    expect(res.body.message).toBeDefined();
    expect(res.headers['cache-control']).toContain('no-cache');
    expect(res.headers['pragma']).toBe('no-cache');
  });

  it('POST /v1/metadata → 405', async () => {
    const res = await supertest(server).post('/v1/metadata').expect(405);
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('PUT /v1/metadata → 405', async () => {
    const res = await supertest(server).put('/v1/metadata').expect(405);
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('DELETE /v1/metadata → 405', async () => {
    const res = await supertest(server).delete('/v1/metadata').expect(405);
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('PATCH /v1/metadata → 405', async () => {
    const res = await supertest(server).patch('/v1/metadata').expect(405);
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('GET /v1/metadata with query params → 400', async () => {
    const res = await supertest(server)
      .get('/v1/metadata?foo=bar')
      .expect(400);
    expect(res.body.error).toBeDefined();
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  it('GET /v1/metadata with body → 400', async () => {
    const res = await supertest(server)
      .get('/v1/metadata')
      .set('Content-Type', 'application/json')
      .send({ foo: 'bar' })
      .expect(400);
    expect(res.body.error).toBeDefined();
    expect(res.headers['cache-control']).toContain('no-cache');
  });

  // ------------------------------------------------------------------ //
  // GET /v1/courses — unauthenticated
  // ------------------------------------------------------------------ //

  it('GET /v1/courses without auth → 401', async () => {
    await supertest(server).get('/v1/courses').expect(401);
  });

  it('POST /v1/courses without auth → 401', async () => {
    await supertest(server).post('/v1/courses').expect(401);
  });

  // ------------------------------------------------------------------ //
  // POST /v1/courses — create course
  // ------------------------------------------------------------------ //

  let courseId: string;
  let courseNumber: string;

  it('POST /v1/courses → 201', async () => {
    const res = await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({
        department_code: 'CSYE',
        number: `${Date.now()}`.slice(-6),
        title: 'Cloud Computing',
        credit_hours: 4,
        classification: 'core',
        description: 'Cloud native development',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.department_code).toBe('CSYE');
    expect(res.body.number).toBeDefined();
    expect(res.body.has_syllabus).toBe(false);
    expect(res.body.date_created).toBeDefined();
    expect(res.body.date_updated).toBeDefined();
    expect(res.headers['location']).toContain('/v1/courses/');
    courseId = res.body.id;
    courseNumber = res.body.number;  
  });

  it('POST /v1/courses duplicate → 409', async () => {
    await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({
        department_code: 'CSYE',
        number: courseNumber,        
        title: 'Cloud Computing Duplicate',
        credit_hours: 4,
        classification: 'core',
      })
      .expect(409);
  });

  it('POST /v1/courses invalid credit_hours → 400', async () => {
    await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({
        department_code: 'CSYE',
        number: '6226',
        title: 'Test',
        credit_hours: 0,
        classification: 'core',
      })
      .expect(400);
  });

  it('POST /v1/courses credit_hours too high → 400', async () => {
    await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({
        department_code: 'CSYE',
        number: '6227',
        title: 'Test',
        credit_hours: 9,
        classification: 'core',
      })
      .expect(400);
  });

  it('POST /v1/courses invalid department_code → 400', async () => {
    await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({
        department_code: 'csye',
        number: '6228',
        title: 'Test',
        credit_hours: 4,
        classification: 'core',
      })
      .expect(400);
  });

  it('POST /v1/courses missing required field → 400', async () => {
    await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({
        department_code: 'CSYE',
        number: '6229',
        credit_hours: 4,
        classification: 'core',
      })
      .expect(400);
  });

  it('POST /v1/courses invalid classification → 400', async () => {
    await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({
        department_code: 'CSYE',
        number: '6230',
        title: 'Test',
        credit_hours: 4,
        classification: 'invalid',
      })
      .expect(400);
  });

  it('POST /v1/courses wrong content-type → 415', async () => {
    await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'text/plain')
      .send('not json')
      .expect(415);
  });

  // ------------------------------------------------------------------ //
  // GET /v1/courses
  // ------------------------------------------------------------------ //

  it('GET /v1/courses → 200 with array', async () => {
    const res = await supertest(server)
      .get('/v1/courses')
      .set('Authorization', authHeader)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ //
  // GET /v1/courses/:id
  // ------------------------------------------------------------------ //

  it('GET /v1/courses/:id → 200', async () => {
    const res = await supertest(server)
      .get(`/v1/courses/${courseId}`)
      .set('Authorization', authHeader)
      .expect(200);

    expect(res.body.id).toBe(courseId);
    expect(res.body.department_code).toBe('CSYE');
  });

  it('GET /v1/courses/:id non-existent → 404', async () => {
    await supertest(server)
      .get('/v1/courses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', authHeader)
      .expect(404);
  });

  // ------------------------------------------------------------------ //
  // PUT /v1/courses/:id
  // ------------------------------------------------------------------ //

  it('PUT /v1/courses/:id → 200', async () => {
    const res = await supertest(server)
      .put(`/v1/courses/${courseId}`)
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({ title: 'Updated Cloud Computing' })
      .expect(200);

    expect(res.body.title).toBe('Updated Cloud Computing');
    expect(res.body.date_updated).toBeDefined();
  });

  it('PUT /v1/courses/:id immutable field → 400', async () => {
    await supertest(server)
      .put(`/v1/courses/${courseId}`)
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({ department_code: 'HACK' })
      .expect(400);
  });

  it('PUT /v1/courses/:id empty body → 400', async () => {
    await supertest(server)
      .put(`/v1/courses/${courseId}`)
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({})
      .expect(400);
  });

  it('PUT /v1/courses/:id non-existent → 404', async () => {
    await supertest(server)
      .put('/v1/courses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({ title: 'Test' })
      .expect(404);
  });

  // ------------------------------------------------------------------ //
  // DELETE /v1/courses/:id
  // ------------------------------------------------------------------ //

  it('DELETE /v1/courses/:id non-existent → 404', async () => {
    await supertest(server)
      .delete('/v1/courses/00000000-0000-0000-0000-000000000000')
      .set('Authorization', authHeader)
      .expect(404);
  });

  it('DELETE /v1/courses/:id → 204', async () => {
    // Create a fresh course to delete
    const res = await supertest(server)
      .post('/v1/courses')
      .set('Authorization', authHeader)
      .set('Content-Type', 'application/json')
      .send({
        department_code: 'INFO',
        number: '9999',
        title: 'To Be Deleted',
        credit_hours: 3,
        classification: 'elective',
      })
      .expect(201);

    await supertest(server)
      .delete(`/v1/courses/${res.body.id}`)
      .set('Authorization', authHeader)
      .expect(204);
  });

  // ------------------------------------------------------------------ //
  // Syllabus endpoints — without S3 (503 expected locally)
  // ------------------------------------------------------------------ //

  it('GET /v1/courses/:id/syllabus without auth → 401', async () => {
    await supertest(server)
      .get(`/v1/courses/${courseId}/syllabus`)
      .expect(401);
  });

  it('GET /v1/courses/:id/syllabus no syllabus → 404', async () => {
    await supertest(server)
      .get(`/v1/courses/${courseId}/syllabus`)
      .set('Authorization', authHeader)
      .expect(404);
  });

  it('GET /v1/courses/non-existent/syllabus → 404', async () => {
    await supertest(server)
      .get('/v1/courses/00000000-0000-0000-0000-000000000000/syllabus')
      .set('Authorization', authHeader)
      .expect(404);
  });

  it('POST /v1/courses/:id/syllabus no file → 400', async () => {
    await supertest(server)
      .post(`/v1/courses/${courseId}/syllabus`)
      .set('Authorization', authHeader)
      .expect(400);
  });

  it('DELETE /v1/courses/:id/syllabus no syllabus → 404', async () => {
    await supertest(server)
      .delete(`/v1/courses/${courseId}/syllabus`)
      .set('Authorization', authHeader)
      .expect(404);
  });

});
console.log(process.env.DB_NAME);