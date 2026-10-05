import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize, requireOwnership } from "../middlewares/auth";
import prisma from "../lib/prisma";
import { getEvent, getEvents, getMyEvents } from "../controllers/event.controllers";
import { validate } from "../middlewares/validate";
import { eventIdParamSchema } from "../schemas/event.schema";

const router = Router();

router.get("/", asyncHandler(getEvents));

router.get("/mine", authenticate, authorize('ORGANIZER'), asyncHandler(getMyEvents));

router.get("/:eventId", validate(eventIdParamSchema, "params"), asyncHandler(getEvent));

router.post("/", authenticate, authorize('ADMIN', 'ORGANIZER'), (req, res) => {
  res.json({ message: "one event created" });
});

router.patch("/:eventId", authenticate, authorize('ADMIN', 'ORGANIZER'), requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }), (req, res) => {
  res.json({ message: "one event patched" });
});

// POST   /events
// PATCH  /events/:id
// POST   /events/:id/publish
// POST   /events/:id/cancel

// POST   /events/:id/ticket-types
// PATCH  /events/:id/ticket-types/:ticketTypeId

// DELETE   /events/:id

export default router;

