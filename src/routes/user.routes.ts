import Router from "express";
import { asyncHandler } from "../middlewares/asyncHandler";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "get alll users" });
});

// router.get("/:userId", asyncHandler(authenticate));

router.post("/", (req, res) => {
  res.json({ message: "one user created" });
});

export default router;

