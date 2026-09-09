import Router from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "get alll events" });
});

router.get("/:eventId", (req, res) => {
  res.json({ eventId: req.params.eventId });
});

router.post("/", (req, res) => {
  res.json({ message: "one event created" });
});

export default router;

