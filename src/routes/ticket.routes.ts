import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "get alll tickets" });
});

router.get("/:ticketId", (req, res) => {
  res.json({ ticketId: req.params.ticketId });
});

router.post("/", (req, res) => {
  res.json({ message: "one ticket created" });
});

export default router;

