import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize } from "../middlewares/auth";

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

export default router;

