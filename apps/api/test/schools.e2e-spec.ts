import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/shared/filters/http-exception.filter';
import { TransformInterceptor } from '../src/shared/interceptors/transform.interceptor';

// TODO: expand with more cases per route (create, update, delete, role checks)
describe('SchoolsController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/schools returns 401 without token', () => {
    return request(app.getHttpServer()).get('/api/v1/schools').expect(401);
  });

  it('POST /api/v1/auth/login with valid credentials returns 200 with token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@oses.pk', password: 'password123' })
      .expect(200);

    expect(response.body.data.tokens.accessToken).toBeDefined();
    authToken = response.body.data.tokens.accessToken as string;
  });

  it('GET /api/v1/schools with valid token returns 200 with data array', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/schools')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
