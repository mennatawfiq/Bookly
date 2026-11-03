import Router from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/asyncHandler';
import { deleteMe, getMe, getUsers } from '../controllers/user.controllers';

const router = Router();

router.get('/', authenticate, authorize('ADMIN'), asyncHandler(getUsers));

router.get('/me', authenticate, asyncHandler(getMe));

router.delete('/me', authenticate, asyncHandler(deleteMe));

export default router;

// PATCH /users/me // change name or password
