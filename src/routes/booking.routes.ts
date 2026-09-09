import Router from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "get alll bookings" });
});

router.get("/:bookingId", (req, res) => {
  res.json({ bookingId: req.params.bookingId });
});

router.post("/", (req, res) => {
  res.json({ message: "one booking created" });
});

export default router;

