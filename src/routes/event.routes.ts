import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize, optionalAuthenticate, requireOwnership } from "../middlewares/auth";
import prisma from "../lib/prisma";
import { cancelEvent, checkIn, deleteTicketType, getEvent, getEventBookings, getEvents, getMyEvents, patchEvent, patchTicketType, postBooking, postEvent, postTicketType, publishEvent } from "../controllers/event.controllers";
import { validate } from "../middlewares/validate";
import { eventIdParamSchema, CreateEventSchema, PatchEventSchema, CheckInSchema } from "../schemas/event.schema";
import { CreateTicketTypeSchema, PatchTicketTypeSchema, TicketTypeIdParamSchema } from "../schemas/ticketType.schema";
import { CreateBookingSchema } from "../schemas/booking.schema";

const router = Router();

router.get("/", optionalAuthenticate, asyncHandler(getEvents));

router.get("/mine", authenticate, authorize('ORGANIZER'), asyncHandler(getMyEvents));

router.get("/:eventId", optionalAuthenticate, validate(eventIdParamSchema, "params"), asyncHandler(getEvent));

router.post("/", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(CreateEventSchema), asyncHandler(postEvent));

router.patch("/:eventId", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(eventIdParamSchema, "params"), validate(PatchEventSchema),
  requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(patchEvent)
);

router.post("/:eventId/publish", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(eventIdParamSchema, "params"),
  requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(publishEvent)
);

router.post("/:eventId/cancel", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(eventIdParamSchema, "params"),
  requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(cancelEvent)
);

router.post("/:eventId/ticket-types", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(eventIdParamSchema, "params"), validate(CreateTicketTypeSchema),
  requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(postTicketType)
);

router.patch("/:eventId/ticket-types/:ticketTypeId", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(TicketTypeIdParamSchema, "params"),
  validate(PatchTicketTypeSchema), requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(patchTicketType)
);

router.delete("/:eventId/ticket-types/:ticketTypeId", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(TicketTypeIdParamSchema, "params"),
  requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(deleteTicketType)
);

router.get("/:eventId/bookings", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(eventIdParamSchema, "params"),
  requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(getEventBookings)
);

router.post("/:eventId/bookings", authenticate, validate(eventIdParamSchema, "params"), validate(CreateBookingSchema), asyncHandler(postBooking));

router.post("/:eventId/check-ins", authenticate, authorize('ORGANIZER'), validate(eventIdParamSchema, "params"),
  validate(CheckInSchema), requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(checkIn));

export default router;
