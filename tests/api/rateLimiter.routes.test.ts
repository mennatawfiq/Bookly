// WHY THIS TEST IS IN ITS OWN FILE
//    The real limiters (loginLimiter, registerLimiter) are created once, when
//    the app loads, and keep their counters in memory. All tests in one file
//    share them, and supertest always sends from the same IP. So tests in the
//    same file would use up each other's limit.

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Runs BEFORE the imports below (vitest moves it to the top of the file).
// This matters because env.ts reads the limits when it is first loaded.
vi.hoisted(() => {
  vi.stubEnv('LOGIN_RATE_LIMIT', '3');
  vi.stubEnv('REGISTER_RATE_LIMIT', '2');
});

import { app } from '../../src/app';
import { cleanTestDatabase } from '../helpers/cleanup';
import { createUser } from '../helpers/auth';

afterEach(async () => {
  await cleanTestDatabase();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

// IMPORTANT: counters are shared by all tests in THIS file (same IP).
// So there is exactly one test per limiter, and each one tells a full story.

describe('rate limiters on the real routes', () => {
  it('POST /auth/login: only failed attempts count, and a blocked user stays blocked', async () => {
    const account = await createUser();
    const wrong = { email: account.credentials.email, password: 'WrongPassword1!' };

    // successful logins are not counted (limit is 3, we log in 5 times)
    for (let i = 0; i < 5; i++) {
      const response = await request(app).post('/auth/login').send(account.credentials);
      expect(response.status).toBe(200);
    }

    // 3 failed attempts are allowed
    for (let i = 0; i < 3; i++) {
      const response = await request(app).post('/auth/login').send(wrong);
      expect(response.status).toBe(401);
    }

    // the 4th is blocked
    const blocked = await request(app).post('/auth/login').send(wrong);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      status: 'fail',
      data: { message: 'Too many login attempts. Please try again later.' },
    });

    // even the right password is blocked now
    const rightButBlocked = await request(app).post('/auth/login').send(account.credentials);
    expect(rightButBlocked.status).toBe(429);
  });

  it('POST /auth/register: the limiter runs before validation and counts every request', async () => {
    const body = (n: number) => ({
      name: 'Jane Doe',
      email: `jane${n}@example.com`,
      password: 'Str0ng!Password',
      confirmPassword: 'Str0ng!Password',
    });

    // limit is 2
    const first = await request(app).post('/auth/register').send(body(1));
    const second = await request(app).post('/auth/register').send(body(2));

    // an EMPTY body would normally get 400 from validate,
    // but the limiter is first, so it gets 429
    const third = await request(app).post('/auth/register').send({});

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
    expect(third.body.data.message).toBe('Too many registration attempts. Please try again later.');
  });
});
