import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize, requireOwnership } from "../middlewares/auth";
import { cancelBooking, cancelTicket, getAllBookings, getBooking, getMyBookings, getTickets } from "../controllers/booking.controllers";
import prisma from "../lib/prisma";
import { bookingIdParamSchema, CancelTicketParamSchema } from "../schemas/booking.schema";
import { validate } from "../middlewares/validate";
import { isEventOrganizer } from "../helpers/auth.helpers";

const router = Router();

router.get("/", authenticate, authorize('ADMIN'), asyncHandler(getAllBookings));

router.get("/mine", authenticate, asyncHandler(getMyBookings));

router.get("/:bookingId", authenticate, validate(bookingIdParamSchema, "params"), requireOwnership({ model: prisma.booking, paramName: "bookingId", ownerField: "userId", resourceName: "Booking", alsoAllow: isEventOrganizer }),
  asyncHandler(getBooking));

router.get("/:bookingId/tickets", authenticate, validate(bookingIdParamSchema, "params"),
  requireOwnership({ model: prisma.booking, paramName: "bookingId", ownerField: "userId", resourceName: "Booking" }),
  asyncHandler(getTickets));

router.post("/:bookingId/cancel", authenticate, validate(bookingIdParamSchema, "params"),
  requireOwnership({ model: prisma.booking, paramName: "bookingId", ownerField: "userId", resourceName: "Booking" }),
  asyncHandler(cancelBooking));

router.post("/:bookingId/tickets/:ticketId/cancel", authenticate, validate(CancelTicketParamSchema, "params"),
  requireOwnership({ model: prisma.booking, paramName: "bookingId", ownerField: "userId", resourceName: "Booking" }),
  asyncHandler(cancelTicket));

export default router;

// POST /bookings/:bookingId/tickets // increase number of tickets
// POST /bookings/:bookingId/tickets/:ticketId/cancel // check BR-B6