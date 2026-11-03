import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Response } from 'express';
import { Prisma } from '../../prisma/generated/client';
import { AppError } from '../../src/errorhandling/appError';
import { errorHandlerRegistery } from '../../src/errorhandling/errorHandler.registery';
import { PrismaErrorHandler } from '../../src/errorhandling/handlers/prismaError.handler';
import { ZodErrorHandler } from '../../src/errorhandling/handlers/zodError.handler';

// a fake response: every jsend method is a spy that remembers how it was called
function makeRes() {
  const jsend = { success: vi.fn(), fail: vi.fn(), error: vi.fn() };
  return { res: { jsend } as unknown as Response, jsend };
}

describe('AppError', () => {
  it('a 4xx error has status fail and a 5xx error has status error', () => {
    expect(new AppError(404, 'x').status).toBe('fail');
    expect(new AppError(409, 'x').status).toBe('fail');
    expect(new AppError(500, 'x').status).toBe('error');
  });

  // it("UnauthorizedError is a 401 AppError with a default message", () => {
  //   const error = new UnauthorizedError();

  //   expect(error).toBeInstanceOf(AppError);
  //   expect(error.statusCode).toBe(401);
  //   expect(error.message).toBe("unauthorized");
  // });
});

describe('PrismaErrorHandler', () => {
  it.each([
    { code: 'P2002', status: 409 },
    { code: 'P2025', status: 404 },
    { code: 'P2003', status: 400 },
  ])('Prisma $code gives $status', ({ code, status }) => {
    const { res, jsend } = makeRes();
    const error = new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });

    new PrismaErrorHandler().handle(error, res);

    expect(jsend.fail).toHaveBeenCalledWith({ message: expect.any(String) }, status);
  });

  it('an unknown Prisma code gives 500 and does not leak the Prisma message', () => {
    const { res, jsend } = makeRes();
    const error = new Prisma.PrismaClientKnownRequestError('secret table name', {
      code: 'P9999',
      clientVersion: 'test',
    });

    new PrismaErrorHandler().handle(error, res);

    expect(jsend.error).toHaveBeenCalledWith('Database error.', 500);
    expect(JSON.stringify(jsend.error.mock.calls)).not.toContain('secret table name');
  });
});

describe('ZodErrorHandler', () => {
  it('reports each failed field, and a nested field is reported as user.email', () => {
    const { res, jsend } = makeRes();
    const result = z
      .object({ user: z.object({ email: z.email() }) })
      .safeParse({ user: { email: 'x' } });
    if (result.success) throw new Error('the data should have failed');

    new ZodErrorHandler().handle(result.error, res);

    expect(jsend.fail).toHaveBeenCalledWith(
      {
        message: 'Validation failed.',
        errors: [{ field: 'user.email', message: expect.any(String) }],
      },
      400,
    );
  });
});

describe('errorHandlerRegistery (which handler wins)', () => {
  it('an AppError 404 is sent as a fail with its own message', () => {
    const { res, jsend } = makeRes();

    errorHandlerRegistery.handle(new AppError(404, 'Event not found'), res);

    expect(jsend.fail).toHaveBeenCalledWith({ message: 'Event not found' }, 404);
  });

  it('an AppError 500 is sent as an error, not as a fail', () => {
    const { res, jsend } = makeRes();

    errorHandlerRegistery.handle(new AppError(500, 'Something broke'), res);

    expect(jsend.error).toHaveBeenCalledWith('Something broke', 500);
    expect(jsend.fail).not.toHaveBeenCalled();
  });

  it('an unknown error gives a generic 500 and does not leak its message', () => {
    const { res, jsend } = makeRes();

    errorHandlerRegistery.handle(new Error('password is hunter2'), res);

    expect(jsend.error).toHaveBeenCalledWith('Internal server error.', 500);
    expect(JSON.stringify(jsend.error.mock.calls)).not.toContain('hunter2');
  });

  it('a Prisma error is not swallowed by the catch-all handler', () => {
    const { res, jsend } = makeRes();
    const error = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });

    errorHandlerRegistery.handle(error, res);

    expect(jsend.fail).toHaveBeenCalledWith(expect.any(Object), 409);
    expect(jsend.error).not.toHaveBeenCalled();
  });
});
