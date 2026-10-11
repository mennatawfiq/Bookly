import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize } from "../middlewares/auth";
import { getAllBookings } from "../controllers/booking.controllers";

const router = Router();

router.get("/", authenticate, authorize('ADMIN'), asyncHandler(getAllBookings));

router.get("/:bookingId", (req, res) => {
  res.json({ bookingId: req.params.bookingId });
});

router.post("/", (req, res) => {
  res.json({ message: "one booking created" });
});

export default router;

// GET /bookings/mine
// GET /bookings/:bookingId 
// GET /bookings admins

// POST /bookings

// PATCH /bookings/:bookingId/cancel
