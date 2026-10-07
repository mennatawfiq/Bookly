import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize, optionalAuthenticate, requireOwnership } from "../middlewares/auth";
import prisma from "../lib/prisma";
import { getEvent, getEvents, getMyEvents, patchEvent, postEvent, publishEvent } from "../controllers/event.controllers";
import { validate } from "../middlewares/validate";
import { eventIdParamSchema, CreateEventSchema, PatchEventSchema } from "../schemas/event.schema";

const router = Router();

router.get("/", asyncHandler(getEvents));

router.get("/mine", authenticate, authorize('ORGANIZER'), asyncHandler(getMyEvents));

router.get("/:eventId", optionalAuthenticate, validate(eventIdParamSchema, "params"), asyncHandler(getEvent));

router.post("/", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(CreateEventSchema), asyncHandler(postEvent));

router.patch("/:eventId", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(eventIdParamSchema, "params"), validate(PatchEventSchema),
  requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(patchEvent));

router.post("/:eventId/publish", authenticate, authorize('ADMIN', 'ORGANIZER'), validate(eventIdParamSchema, "params"),
  requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }),
  asyncHandler(publishEvent)
);


// POST   /events
// PATCH  /events/:id
// POST   /events/:id/publish // must check the event has ticket types set first
// POST   /events/:id/cancel

// POST   /events/:id/ticket-types
// PATCH  /events/:id/ticket-types/:ticketTypeId

// DELETE   /events/:id // delete only if status = "CANCELLED"

export default router;

