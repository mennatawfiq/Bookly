import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate, authorize } from "../middlewares/auth";
import { getAllBookings, getMyBookings } from "../controllers/booking.controllers";

const router = Router();

router.get("/", authenticate, authorize('ADMIN'), asyncHandler(getAllBookings));

router.get("/mine", authenticate, asyncHandler(getMyBookings));

router.get("/:bookingId", (req, res) => {
  res.json({ bookingId: req.params.bookingId });
});

router.post("/", (req, res) => {
  res.json({ message: "one booking created" });
});

export default router;

// GET /bookings/mine
// GET /bookings/:bookingId 

// POST /bookings

// PATCH /bookings/:bookingId/cancel
