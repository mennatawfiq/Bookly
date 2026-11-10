import { Router } from 'express';
import { register, login } from '../controllers/auth.controllers';
import { validate } from '../middlewares/validate';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { asyncHandler } from '../middlewares/asyncHandler';
import { loginLimiter, registerLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), asyncHandler(register));

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(login));

export default router;
