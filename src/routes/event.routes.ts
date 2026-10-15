import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize, optionalAuthenticate, requireOwnership } from "../middlewares/auth";
import prisma from "../lib/prisma";
import { deleteTicketType, getEvent, getEventBookings, getEvents, getMyEvents, patchEvent, patchTicketType, postEvent, postTicketType, publishEvent } from "../controllers/event.controllers";
import { validate } from "../middlewares/validate";
import { eventIdParamSchema, CreateEventSchema, PatchEventSchema } from "../schemas/event.schema";
import { CreateTicketTypeSchema, PatchTicketTypeSchema, TicketTypeIdParamSchema } from "../schemas/ticketType.schema";

const router = Router();

router.get("/", asyncHandler(getEvents));

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

// router.post("/:eventId/cancel", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(eventIdParamSchema, "params"),
//   requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
//   asyncHandler(cancelEvent)
// );


// POST   /events/:id/cancel

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

export default router;

// GET /events/:eventId/bookings // list event bookings, allowed for organizers and admins

// POST /events/:eventId/bookings // create a booking, by the user

// POST /events/:eventId/check-ins // send ticket QR code in the body
