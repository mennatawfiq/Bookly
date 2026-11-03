import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';

describe('Express application', () => {
  it('serves the OpenAPI document', async () => {
    const response = await request(app).get('/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });
});
