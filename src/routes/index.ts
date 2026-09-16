import Router from "express";

import authRouter from "./auth.routes";
import eventRouter from "./event.routes";
import userRouter from "./auth.routes";
import ticketRouter from "./ticket.routes";
import bookingRouter from "./booking.routes";

const router = Router();

router.use("/auth", authRouter);
router.use("/events", eventRouter);// authentication/authorization, body validation
router.use("/users", userRouter);
router.use("/tickets", ticketRouter);
router.use("/bookings", bookingRouter);


export default router;