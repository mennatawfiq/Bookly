import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../src/middlewares/rateLimiter';
import { jsend } from '../../src/middlewares/jsend';
import { errorHandler } from '../../src/middlewares/errorHandler';
import { AppError } from '../../src/errorhandling/appError';

// A tiny app: one route that always succeeds, one that always fails with 401.
// Both use the SAME limiter, so they share one counter.
function buildApp(limiter: RequestHandler) {
  const app = express();
  app.use(express.json());
  app.use(jsend);

  app.get('/ok', limiter, (req, res) => {
    res.jsend.success({ ok: true });
  });

  app.get('/fail', limiter, (req, res, next) => {
    next(new AppError(401, 'Nope'));
  });

  app.use(errorHandler);
  return app;
}

describe('createRateLimiter', () => {
  it('allows requests up to the limit, then returns 429 with a JSend body', async () => {
    const app = buildApp(createRateLimiter(15, 2, 'Too many requests.'));

    const first = await request(app).get('/ok');
    const second = await request(app).get('/ok');
    const third = await request(app).get('/ok');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body).toEqual({
      status: 'fail',
      data: { message: 'Too many requests.' },
    });
  });

  it('sends standard rate limit headers and no legacy ones', async () => {
    const app = buildApp(createRateLimiter(15, 2, 'Too many requests.'));

    const response = await request(app).get('/ok');

    expect(response.headers['ratelimit-limit']).toBe('2');
    expect(response.headers['ratelimit-remaining']).toBe('1');
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('counts successful requests by default', async () => {
    const app = buildApp(createRateLimiter(15, 2, 'Too many requests.'));

    await request(app).get('/ok');
    await request(app).get('/ok');
    const blocked = await request(app).get('/ok');

    expect(blocked.status).toBe(429);
  });

  it('with skipSuccessfulRequests, successful requests are not counted', async () => {
    const app = buildApp(createRateLimiter(15, 2, 'Too many requests.', true));

    // 5 successes, more than the limit of 2
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/ok');
      expect(response.status).toBe(200);
    }

    // Failed requests (401) are counted: 2 allowed, the 3rd is blocked
    const fail1 = await request(app).get('/fail');
    const fail2 = await request(app).get('/fail');
    const fail3 = await request(app).get('/fail');

    expect(fail1.status).toBe(401);
    expect(fail2.status).toBe(401);
    expect(fail3.status).toBe(429);
  });

  it('once blocked, even a request that would succeed gets 429', async () => {
    const app = buildApp(createRateLimiter(15, 1, 'Too many requests.', true));

    await request(app).get('/fail'); // uses the only allowed attempt
    const blocked = await request(app).get('/ok'); // would be 200 if not blocked

    expect(blocked.status).toBe(429);
  });

  it('each limiter has its own counter', async () => {
    const appA = buildApp(createRateLimiter(15, 1, 'Too many requests.'));
    const appB = buildApp(createRateLimiter(15, 1, 'Too many requests.'));

    await request(appA).get('/ok');
    const blockedA = await request(appA).get('/ok');
    const freshB = await request(appB).get('/ok');

    expect(blockedA.status).toBe(429);
    expect(freshB.status).toBe(200);
  });
});
