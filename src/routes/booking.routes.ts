import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize, requireOwnership } from "../middlewares/auth";
import { getAllBookings, getBooking, getMyBookings } from "../controllers/booking.controllers";
import prisma from "../lib/prisma";
import { bookingIdParamSchema } from "../schemas/booking.schema";
import { validate } from "../middlewares/validate";
import { isEventOrganizer } from "../helpers/auth.helpers";

const router = Router();

router.get("/", authenticate, authorize('ADMIN'), asyncHandler(getAllBookings));

router.get("/mine", authenticate, asyncHandler(getMyBookings));

router.get("/:bookingId", authenticate, validate(bookingIdParamSchema, "params"), requireOwnership({ model: prisma.booking, paramName: "bookingId", ownerField: "userId", resourceName: "Booking", alsoAllow: isEventOrganizer }),
  asyncHandler(getBooking));

router.post("/", (req, res) => {
  res.json({ message: "one booking created" });
});

export default router;

// GET /bookings/:bookingId 

// POST /bookings

// PATCH /bookings/:bookingId/cancel
