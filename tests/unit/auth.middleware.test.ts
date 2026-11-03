import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request, RequestHandler, Response } from 'express';
import {
  authenticate,
  authorize,
  optionalAuthenticate,
  requireOwnership,
} from '../../src/middlewares/auth';
import { AppError } from '../../src/errorhandling/appError';
import { env } from '../../src/config/env';
import type { AuthenticatedUser } from '../../src/types/auth';

// runs a middleware and gives back what it passed to next(): nothing (it passed) or an error
function run(middleware: RequestHandler, req: object) {
  return new Promise<unknown>((resolve) => {
    middleware(req as Request, {} as Response, resolve);
  });
}

function expectAppError(result: unknown, statusCode: number, message?: string) {
  expect(result).toBeInstanceOf(AppError);
  expect((result as AppError).statusCode).toBe(statusCode);
  if (message) {
    expect((result as AppError).message).toBe(message);
  }
}

describe("authenticate (the parts that don't need the database)", () => {
  it('no Authorization header gives 401', async () => {
    const result = await run(authenticate, { headers: {} });

    expectAppError(result, 401, 'Authentication required');
  });

  it.each(['abc', 'Basic abc', 'Bearer'])(
    'the header "%s" gives 401 invalid authorization header',
    async (header) => {
      const result = await run(authenticate, { headers: { authorization: header } });

      expectAppError(result, 401, 'Invalid authorization header');
    },
  );

  it('a garbage token gives 401', async () => {
    const result = await run(authenticate, { headers: { authorization: 'Bearer abc' } });

    expectAppError(result, 401, 'Invalid or expired token');
  });

  it('a token signed with another secret gives 401', async () => {
    const token = jwt.sign({ sub: 'u1' }, 'another-secret');
    const result = await run(authenticate, { headers: { authorization: `Bearer ${token}` } });

    expectAppError(result, 401, 'Invalid or expired token');
  });

  it('an expired token gives 401', async () => {
    const token = jwt.sign({ sub: 'u1' }, env.JWT_SECRET, { expiresIn: -10 });
    const result = await run(authenticate, { headers: { authorization: `Bearer ${token}` } });

    expectAppError(result, 401, 'Invalid or expired token');
  });

  it('a valid token without a sub gives 401', async () => {
    const token = jwt.sign({ foo: 'bar' }, env.JWT_SECRET);
    const result = await run(authenticate, { headers: { authorization: `Bearer ${token}` } });

    expectAppError(result, 401, 'Invalid token');
  });
});

describe('optionalAuthenticate', () => {
  it('no header: passes and does not set a user', async () => {
    const req: { headers: object; user?: AuthenticatedUser } = { headers: {} };
    const result = await run(optionalAuthenticate, req);

    expect(result).toBeUndefined();
    expect(req.user).toBeUndefined();
  });

  it('a bad header is still rejected with 401', async () => {
    const result = await run(optionalAuthenticate, { headers: { authorization: 'abc' } });

    expectAppError(result, 401);
  });
});

describe('authorize', () => {
  it('lets a user with an allowed role pass', async () => {
    const result = await run(authorize('ORGANIZER', 'ADMIN'), {
      user: { id: 'u1', role: 'ORGANIZER' },
    });

    expect(result).toBeUndefined();
  });

  it('blocks a user with another role with 403', async () => {
    const result = await run(authorize('ORGANIZER'), { user: { id: 'u1', role: 'USER' } });

    expectAppError(result, 403, 'You do not have permission to perform this action');
  });

  it('blocks a request without a user', async () => {
    const result = await run(authorize('ORGANIZER'), {});

    expectAppError(result, 403);
  });
});

describe('requireOwnership', () => {
  type Doc = { id: string; ownerId: string };

  const owner: AuthenticatedUser = { id: 'u1', role: 'USER' };
  const stranger: AuthenticatedUser = { id: 'u2', role: 'USER' };
  const admin: AuthenticatedUser = { id: 'u3', role: 'ADMIN' };
  const doc: Doc = { id: 'd1', ownerId: 'u1' };

  // the model is a fake with one method, so no database is needed
  function setup(
    found: Doc | null,
    alsoAllow?: (d: Doc, u: AuthenticatedUser) => Promise<boolean>,
  ) {
    const findUnique = vi.fn().mockResolvedValue(found);
    const middleware = requireOwnership<Doc>({
      model: { findUnique },
      paramName: 'docId',
      ownerField: 'ownerId',
      resourceName: 'Doc',
      ...(alsoAllow ? { alsoAllow } : {}),
    });
    return { middleware, findUnique };
  }

  it('an admin passes without any database lookup', async () => {
    const { middleware, findUnique } = setup(doc);
    const result = await run(middleware, { user: admin, params: { docId: 'd1' } });

    expect(result).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('the owner passes, and the resource is looked up by the id from the URL', async () => {
    const { middleware, findUnique } = setup(doc);
    const result = await run(middleware, { user: owner, params: { docId: 'd1' } });

    expect(result).toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'd1' } });
  });

  it('someone else gets the same 404 as for a missing resource', async () => {
    const notYours = await run(setup(doc).middleware, { user: stranger, params: { docId: 'd1' } });
    const missing = await run(setup(null).middleware, { user: stranger, params: { docId: 'd1' } });

    expectAppError(notYours, 404, 'Doc not found');
    expectAppError(missing, 404, 'Doc not found');
  });

  it('alsoAllow lets someone else pass, and receives the resource and the user', async () => {
    const alsoAllow = vi.fn().mockResolvedValue(true);
    const { middleware } = setup(doc, alsoAllow);
    const result = await run(middleware, { user: stranger, params: { docId: 'd1' } });

    expect(result).toBeUndefined();
    expect(alsoAllow).toHaveBeenCalledWith(doc, stranger);
  });

  it('alsoAllow returning false does not help', async () => {
    const { middleware } = setup(doc, vi.fn().mockResolvedValue(false));
    const result = await run(middleware, { user: stranger, params: { docId: 'd1' } });

    expectAppError(result, 404, 'Doc not found');
  });

  it('a request without a user gets 401', async () => {
    const { middleware } = setup(doc);
    const result = await run(middleware, { params: { docId: 'd1' } });

    expectAppError(result, 401);
  });

  it('a missing id in the URL gets 400', async () => {
    const { middleware } = setup(doc);
    const result = await run(middleware, { user: owner, params: {} });

    expectAppError(result, 400, 'Invalid Doc id');
  });
});
