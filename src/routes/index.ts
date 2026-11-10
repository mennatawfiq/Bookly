import { Router } from 'express';

import authRouter from './auth.routes';
import eventRouter from './event.routes';
import userRouter from './user.routes';
import bookingRouter from './booking.routes';
import organizerApplicationsRouter from './organizerApplication.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/events', eventRouter);
router.use('/users', userRouter);
router.use('/bookings', bookingRouter);
router.use('/organizer-applications', organizerApplicationsRouter);

export default router;
