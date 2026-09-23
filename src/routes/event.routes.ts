import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize, requireOwnership } from "../middlewares/auth";
import prisma from "../lib/prisma";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "get alll events" });
});

router.get("/:eventId", (req, res) => {
  res.json({ eventId: req.params.eventId });
});

router.post("/", authenticate, authorize('ADMIN', 'ORGANIZER'), (req, res) => {
  res.json({ message: "one event created" });
});

router.patch("/:eventId", authenticate, authorize('ADMIN', 'ORGANIZER'), requireOwnership({ model: prisma.event, paramName: "eventId", ownerField: "organizerId", resourceName: "Event" }), (req, res) => {
  res.json({ message: "one event patched" });
});

export default router;

