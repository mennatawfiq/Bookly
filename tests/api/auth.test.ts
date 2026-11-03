import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import prisma from '../../src/lib/prisma';
import { cleanTestDatabase } from '../helpers/cleanup';
import { createUser, authHeader, deleteUser } from '../helpers/auth';

afterEach(async () => {
  await cleanTestDatabase();
});

const validBody = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  password: 'Str0ng!Password',
  confirmPassword: 'Str0ng!Password',
};

describe('POST /auth/register route tests', () => {
  it('registers a new user', async () => {
    const response = await request(app).post('/auth/register').send(validBody);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('success');
    expect(response.body.data.user.email).toBe(validBody.email);
    expect(response.body.data.user.role).toBe('USER');
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(response.body.data.user).not.toHaveProperty('password');
  });

  it('stores a hashed password, not the plain one', async () => {
    await request(app).post('/auth/register').send(validBody);
    const saved = await prisma.user.findUniqueOrThrow({ where: { email: validBody.email } });

    expect(saved.passwordHash).not.toBe(validBody.password);
    expect(saved.passwordHash.length).toBeGreaterThan(20);
  });

  it('ignores a role sent in the body, the user is always a USER', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ ...validBody, role: 'ADMIN' });

    const saved = await prisma.user.findUniqueOrThrow({ where: { email: validBody.email } });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('USER');
    expect(saved.role).toBe('USER');
  });

  it("a registered email can't register again", async () => {
    await request(app).post('/auth/register').send(validBody);
    const response = await request(app).post('/auth/register').send(validBody);

    expect(response.status).toBe(409);
    expect(response.body.status).toBe('fail');
    expect(response.body.data.message).toBe('Email is already registered.');
  });

  it('the email of a deleted account can be used again', async () => {
    const account = await createUser();
    await deleteUser(account.user.id);
    const response = await request(app)
      .post('/auth/register')
      .send({ ...validBody, email: account.user.email });

    expect(response.status).toBe(201);
  });

  it('a weak password should get 400', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ ...validBody, password: 'weak', confirmPassword: 'weak' });

    expect(response.status).toBe(400);
    expect(response.body.data.message).toBe('Validation failed.');
    expect(response.body.data.errors[0].field).toBe('password');
  });

  it("passwords that don't match should get 400", async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ ...validBody, confirmPassword: 'Different1!Password' });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe('confirmPassword');
  });

  it('an invalid email should get 400', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({ ...validBody, email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe('email');
  });

  it('a missing name should get 400', async () => {
    const { name: _name, ...withoutName } = validBody;
    const response = await request(app).post('/auth/register').send(withoutName);

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe('name');
  });
});

describe('POST /auth/login route tests', () => {
  it('logs in with the right credentials', async () => {
    const account = await createUser();
    const response = await request(app).post('/auth/login').send(account.credentials);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data.user.id).toBe(account.user.id);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(typeof response.body.data.token).toBe('string');
  });

  it('the returned token belongs to the user and works', async () => {
    const account = await createUser();
    const login = await request(app).post('/auth/login').send(account.credentials);

    const token = login.body.data.token;
    const decoded = jwt.decode(token) as { sub: string };
    const me = await request(app).get('/users/me').set(authHeader(token));

    expect(decoded.sub).toBe(account.user.id);
    expect(me.status).toBe(200);
  });

  it('a wrong password should get 401', async () => {
    const account = await createUser();
    const response = await request(app)
      .post('/auth/login')
      .send({ email: account.user.email, password: 'WrongPassword1!' });

    expect(response.status).toBe(401);
    expect(response.body.status).toBe('fail');
    expect(response.body.data.message).toBe('Invalid email or password');
  });

  it('an unknown email gets the same response as a wrong password', async () => {
    const account = await createUser();
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email: account.user.email, password: 'WrongPassword1!' });
    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassword1!' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it("a deleted account can't log in", async () => {
    const account = await createUser();
    await deleteUser(account.user.id);
    const response = await request(app).post('/auth/login').send(account.credentials);

    expect(response.status).toBe(401);
    expect(response.body.data.message).toBe('Invalid email or password');
  });

  it('an invalid email format should get 400', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'whatever' });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe('email');
  });

  it('a missing password should get 400', async () => {
    const response = await request(app).post('/auth/login').send({ email: 'jane@example.com' });

    expect(response.status).toBe(400);
    expect(response.body.data.errors[0].field).toBe('password');
  });
});
