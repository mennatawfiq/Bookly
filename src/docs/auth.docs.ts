import { z } from 'zod';
import { registry } from './registry';
import { loginSchema } from '../schemas/auth.schema';
import { jsonResponse } from './helpers';
import { jsendSuccess } from '../schemas/jsend.schema';
import { MessageFailResponse, ValidationFailResponse, ServerErrorResponse } from './jsend.docs';
import { RegisterRequest, RegisterSuccess, UserSummary } from './components';

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  description:
    'Creates a new Bookly account with the default USER role. `password` and `confirmPassword` must match.',
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: RegisterRequest },
      },
    },
  },
  responses: {
    201: jsonResponse('User registered successfully', RegisterSuccess),
    400: jsonResponse('Validation failed', ValidationFailResponse),
    409: jsonResponse('Email is already registered', MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});

export const LoginRequest = registry.register('LoginRequest', loginSchema);
const LoginSuccess = registry.register(
  'LoginSuccess',
  jsendSuccess(
    z.object({
      user: UserSummary,
      token: z.string().meta({
        description: 'JWT access token. Send it as `Authorization: Bearer <token>`.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      }),
    }),
  ),
);

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Log in',
  description:
    'Verifies the email and password and returns the user together with a JWT access token.',
  request: {
    body: {
      required: true,
      content: {
        'application/json': { schema: LoginRequest },
      },
    },
  },
  responses: {
    200: jsonResponse('Logged in successfully', LoginSuccess),
    400: jsonResponse('Validation failed', ValidationFailResponse),
    401: jsonResponse('Invalid email or password', MessageFailResponse),
    500: jsonResponse('Internal server error', ServerErrorResponse),
  },
});
